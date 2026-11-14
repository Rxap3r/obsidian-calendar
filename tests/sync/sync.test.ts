(globalThis as any).window = globalThis;
import { AuthSession } from "../../src/sync/oauth";
import { apiRequest } from "../../src/sync/http";
import { GoogleProvider, OutlookProvider } from "../../src/sync/providers";
import { setHandler, calls } from "obsidian";
import { createHash } from "crypto";

let failures = 0;
const ok = (cond: any, msg: string) => { console.log(`${cond ? "PASS" : "FAIL"} ${msg}`); if (!cond) failures++; };

async function testOAuth(provider: "google" | "outlook") {
  const acc = { id: "a1", provider, label: "", clientId: provider === "google" ? "x.apps.googleusercontent.com" : "00000000-0000-0000-0000-000000000000", tenant: "common" } as any;
  const cfg = (provider === "google" ? GoogleProvider : OutlookProvider).oauthConfig(acc, provider === "google" ? "sec" : undefined);
  const s = new AuthSession(cfg);
  await s.start();
  const u = new URL(s.authUrl);
  ok(s.automatic, `${provider}: loopback server started`);
  ok(u.searchParams.get("code_challenge_method") === "S256", `${provider}: PKCE S256`);
  ok((u.searchParams.get("state") ?? "").length >= 40, `${provider}: long random state`);
  ok(s.redirectUri.startsWith(provider === "google" ? "http://127.0.0.1:" : "http://localhost:"), `${provider}: redirect ${s.redirectUri}`);
  ok(!u.searchParams.get("scope")!.includes("email") && !u.searchParams.get("scope")!.includes("Mail"), `${provider}: no mail/profile scopes (${u.searchParams.get("scope")})`);
  const port = new URL(s.redirectUri).port;
  // forged callback with wrong state is rejected and does not end the session
  let r = await fetch(`http://127.0.0.1:${port}/?state=evil&code=stolen`);
  ok(r.status === 400, `${provider}: wrong state rejected (${r.status})`);
  r = await fetch(`http://127.0.0.1:${port}/other?state=${s.state}&code=c`);
  ok(r.status === 404, `${provider}: other paths rejected`);
  r = await fetch(`http://127.0.0.1:${port}/?state=${encodeURIComponent(s.state)}&code=good-code`, { method: "POST" });
  ok(r.status === 405, `${provider}: POST rejected`);
  r = await fetch(`http://127.0.0.1:${port}/?state=${encodeURIComponent(s.state)}&code=good-code`);
  ok(r.status === 200 && r.headers.get("cache-control") === "no-store", `${provider}: valid callback accepted`);
  const code = await s.code;
  ok(code === "good-code", `${provider}: code received`);
  let closed = false;
  try { await fetch(`http://127.0.0.1:${port}/?state=x`); } catch { closed = true; }
  ok(closed, `${provider}: loopback server closed after use`);
  // token exchange: verify PKCE verifier matches challenge
  let body: URLSearchParams | null = null;
  setHandler((req) => { body = new URLSearchParams(req.body); return { status: 200, body: { access_token: "AT", refresh_token: "RT", expires_in: 3600 } }; });
  const t = await s.exchange(code);
  const verifier = body!.get("code_verifier")!;
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  ok(challenge === u.searchParams.get("code_challenge"), `${provider}: verifier matches challenge`);
  ok(t.refreshToken === "RT" && t.accessToken === "AT", `${provider}: tokens parsed`);
  ok(calls[calls.length - 1].url.startsWith("https://"), `${provider}: token endpoint is https (${calls[calls.length - 1].url})`);
  // token error does not leak request contents
  setHandler(() => ({ status: 400, body: { error: "invalid_grant", error_description: "Bad Request" } }));
  try { await s.exchange("c2"); ok(false, "error expected"); } catch (e: any) { ok(e.code === "invalid_grant" && !String(e.message).includes("c2"), `${provider}: token error sanitized (${e.message})`); }
}

async function testManual() {
  const cfg = GoogleProvider.oauthConfig({ id: "a", provider: "google", label: "", clientId: "x" } as any, "s");
  const s = new AuthSession(cfg);
  await s.start();
  let threw = false;
  try { s.submitRedirectUrl(`https://evil.example/?state=${s.state}&code=x`); } catch { threw = true; }
  ok(threw, "manual: foreign host rejected");
  threw = false;
  try { s.submitRedirectUrl(`${s.redirectUri}/?state=nope&code=x`); } catch { threw = true; }
  ok(threw, "manual: wrong state rejected");
  s.submitRedirectUrl(`${s.redirectUri}/?state=${encodeURIComponent(s.state)}&code=pasted`);
  ok((await s.code) === "pasted", "manual: pasted redirect accepted");
}

async function testApi() {
  let threw = "";
  try { await apiRequest(async () => "T", { url: "https://evil.example.com/x" }); } catch (e: any) { threw = e.message; }
  ok(threw.includes("Refusing"), "api: token never sent to foreign host");
  try { await apiRequest(async () => "T", { url: "http://www.googleapis.com/x" }); threw = ""; } catch (e: any) { threw = e.message; }
  ok(threw.includes("Refusing"), "api: http (non-TLS) refused");
  // 401 -> refresh -> retry
  let n = 0; const forced: boolean[] = [];
  setHandler((req) => { n++; return req.headers.Authorization === "Bearer NEW" ? { status: 200, body: { ok: 1 } } : { status: 401, body: {} }; });
  const res = await apiRequest(async (f) => { forced.push(!!f); return f ? "NEW" : "OLD"; }, { url: "https://www.googleapis.com/x" });
  ok(res?.ok === 1 && n === 2 && forced[1] === true, "api: 401 triggers one token refresh + retry");
}

async function testGoogle() {
  const T = async () => "T";
  setHandler((req) => {
    if (req.url.includes("/events?")) return { status: 200, body: { items: [
      { id: "e1", etag: '"1"', summary: "Timed", start: { dateTime: "2026-11-20T09:00:00+01:00" }, end: { dateTime: "2026-11-20T10:00:00+01:00" }, htmlLink: "https://calendar.google.com/e1" },
      { id: "e2", summary: "AllDay", start: { date: "2026-11-25" }, end: { date: "2026-11-27" } },
      { id: "e3_20261121T080000Z", recurringEventId: "e3", summary: "Instance", start: { dateTime: "2026-11-21T08:00:00Z" }, end: { dateTime: "2026-11-21T09:00:00Z" } },
      { id: "e4", status: "cancelled", start: { date: "2026-11-22" } },
    ] } };
    return { status: 200, body: {} };
  });
  const evs = await GoogleProvider.listEvents(T, "primary", new Date(2026, 10, 1), new Date(2026, 11, 1));
  ok(evs.length === 3, `google: cancelled skipped (${evs.length})`);
  ok(evs[0].start.toISOString() === "2026-11-20T08:00:00.000Z", "google: timed event converted");
  ok(evs[1].allDay && evs[1].start.getDate() === 25 && evs[1].end.getDate() === 27, "google: all-day exclusive end");
  ok(evs[2].seriesId === "e3", "google: instance -> series id");
  const last = calls[calls.length - 1];
  ok(last.url.includes("singleEvents=true") && last.headers.Authorization === "Bearer T", "google: expanded instances requested with bearer");

  let sent: any;
  setHandler((req) => { sent = req; return { status: 200, body: {} }; });
  await GoogleProvider.createEvent(T, "me@gmail.com", { title: "New", allDay: false, start: new Date(2026, 10, 20, 9, 30), end: new Date(2026, 10, 20, 10, 0), recurrence: { freq: "weekly", interval: 2, count: 5 } });
  const b = JSON.parse(sent.body);
  ok(sent.url.endsWith("/calendars/me%40gmail.com/events") && sent.method === "POST", "google: create url encoded");
  ok(b.start.dateTime === "2026-11-20T09:30:00" && b.start.timeZone && b.recurrence[0] === "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=5", `google: create body ${JSON.stringify(b.start)} ${b.recurrence}`);
  await GoogleProvider.updateEvent(T, "primary", "e1", { title: "Upd", allDay: true, start: new Date(2026, 10, 20), end: new Date(2026, 10, 21), recurrence: { freq: "daily", interval: 1 } }, '"1"');
  const ub = JSON.parse(sent.body);
  ok(sent.method === "PATCH" && sent.headers["If-Match"] === '"1"', "google: update uses If-Match etag");
  ok(ub.start.date === "2026-11-20" && ub.start.dateTime === null && ub.end.date === "2026-11-21" && !ub.recurrence, "google: patch all-day, no recurrence change");
  await GoogleProvider.deleteEvent(T, "primary", "e1", '"1"');
  ok(sent.method === "DELETE" && sent.headers["If-Match"] === '"1"', "google: delete with If-Match");
}

async function testOutlook() {
  const T = async () => "T";
  setHandler((req) => {
    if (req.url.includes("calendarView")) return { status: 200, body: { value: [
      { id: "o1", "@odata.etag": 'W/"x"', subject: "Timed", isAllDay: false, start: { dateTime: "2026-11-20T08:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-11-20T09:00:00.0000000", timeZone: "UTC" }, location: { displayName: "Room" }, body: { content: "Hi" } },
      { id: "o2", subject: "AllDay", isAllDay: true, start: { dateTime: "2026-11-25T00:00:00.0000000" }, end: { dateTime: "2026-11-26T00:00:00.0000000" } },
      { id: "o3", type: "occurrence", seriesMasterId: "m1", subject: "Series", start: { dateTime: "2026-11-21T07:00:00.0000000" }, end: { dateTime: "2026-11-21T08:00:00.0000000" } },
      { id: "o4", isCancelled: true, subject: "X", start: { dateTime: "2026-11-21T07:00:00.0000000" }, end: { dateTime: "2026-11-21T08:00:00.0000000" } },
    ] } };
    return { status: 201, body: {} };
  });
  const evs = await OutlookProvider.listEvents(T, "cal1", new Date(2026, 10, 1), new Date(2026, 11, 1));
  ok(evs.length === 3, "outlook: cancelled skipped");
  ok(evs[0].start.toISOString() === "2026-11-20T08:00:00.000Z" && evs[0].location === "Room", "outlook: UTC times parsed");
  ok(evs[1].allDay && evs[1].start.getDate() === 25 && evs[1].end.getDate() === 26, "outlook: all-day dates");
  ok(evs[2].seriesId === "m1", "outlook: series id");
  ok(calls[calls.length - 1].headers.Prefer.includes('outlook.timezone="UTC"'), "outlook: requests UTC");
  let sent: any;
  setHandler((req) => { sent = req; return { status: 201, body: {} }; });
  await OutlookProvider.createEvent(T, "cal1", { title: "N", allDay: false, start: new Date(2026, 10, 18, 14, 0), end: new Date(2026, 10, 18, 15, 0), recurrence: { freq: "weekly", interval: 1, until: "2026-12-31" } });
  const b = JSON.parse(sent.body);
  ok(b.recurrence.pattern.type === "weekly" && b.recurrence.pattern.daysOfWeek[0] === "wednesday" && b.recurrence.range.type === "endDate", `outlook: recurrence ${JSON.stringify(b.recurrence)}`);
  ok(b.start.dateTime === "2026-11-18T14:00:00", "outlook: local wall time + tz");
  await OutlookProvider.updateEvent(T, "cal1", "o1", { title: "U", allDay: false, start: new Date(), end: new Date(), recurrence: { freq: "daily", interval: 1 } }, 'W/"x"');
  ok(sent.method === "PATCH" && sent.url.endsWith("/me/events/o1") && sent.headers["If-Match"] === 'W/"x"' && !JSON.parse(sent.body).recurrence, "outlook: patch with etag, no recurrence");
  const acc = { id: "a", provider: "outlook", clientId: "c", tenant: "evil.com/../x" } as any;
  ok(OutlookProvider.oauthConfig(acc).authUrl.includes("/common/"), "outlook: invalid tenant falls back to common");
}

(async () => {
  await testOAuth("google");
  await testOAuth("outlook");
  await testManual();
  await testApi();
  await testGoogle();
  await testOutlook();
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
})();
