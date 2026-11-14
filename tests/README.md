# Tests

Two automated test suites. Neither needs Obsidian, a real phone, or real Google / Microsoft accounts.

```bash
npm test            # build + both suites
npm run test:sync   # sign-in (OAuth/PKCE) and Google / Outlook connectors – Node only
npm run test:ui     # views, dialogs, settings, touch gestures – headless Chromium
npm run test:ui -- mobile   # only UI tests whose name contains "mobile"
```

Requirements: `npm install`, plus **Playwright with Chromium**. In Claude Code's cloud environment it is
pre-installed. Locally you can use `npm i -D playwright && npx playwright install chromium`.

## `tests/sync/` (Node)

- `sync.test.ts` covers the following, against simulated provider responses:
  - PKCE S256 challenge and verifier;
  - a random `state` that rejects forged or foreign responses;
  - the loopback server: GET `/` only, closes after use;
  - the manual paste flow;
  - token errors without leaked secrets;
  - no tokens sent to non-provider hosts or over plain http;
  - one retry with a refreshed token after a 401;
  - Google and Graph event mapping (time zones, all-day, series instances, cancelled);
  - request bodies (RRULE / Graph recurrence) and the `If-Match` ETag on update and delete.
- `obsidian-mock.ts` is a tiny stand-in for `requestUrl` / `Platform`.

## `tests/ui/` (browser)

- `entry.ts` boots the **real plugin** against `obsidian-mock.ts`, which is a stand-in for the parts of the
  Obsidian API the plugin uses. It also creates fixtures:
  - local events around "today";
  - a *Work* calendar;
  - `fixtures.ics`, a subscription with time zones, exceptions, EXDATE and a cancelled event;
  - a fake signed-in Google account with a writable and a read-only calendar.
- `run.cjs` is the test runner. Each test gets a fresh page.
  - **Time is frozen at 2026-11-14 10:00 Europe/Zurich**, so results are reproducible.
  - Desktop tests run at 1400×900. Mobile tests use a 390×800 touch device (`{ mobile: true }`), which also sets
    Obsidian's `Platform.isMobile`.
  - Touch gestures are sent with real CDP touch events.
- Screenshots of key screens go to `tests/.out/shots/`. That folder is git-ignored. Look at them after UI changes.
  Failing tests also save a `FAIL-*.png`.

### Writing a new UI test

```js
test("mobile: my feature", { mobile: true }, async ({ page, ctx }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.waitForTimeout(150);
	eq(await page.locator(".ch-tg-col").count(), 7, "columns");
});
```

Globals in the page: `plugin`, `view` (full calendar), `mini` (sidebar calendar), `tab` (settings tab),
`ws` (fake workspace with `leaves`, `fireLayoutChange()`), `lastModal`, `lastMenu`, `notices`, `__Platform`.
If the plugin starts using a new Obsidian API, add it to `obsidian-mock.ts`.

### Limits

These tests simulate Obsidian and the browser. They can't show:
- real Obsidian layout or theme details;
- real phone scrolling physics (bounce, momentum);
- Obsidian mobile's own ribbon / toolbar handling;
- real Google / Microsoft sign-in.

Mention these in PRs ("not tested on a real device / in real Obsidian") and ask the maintainer to try them.
