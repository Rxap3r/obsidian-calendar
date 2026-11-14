/* eslint-disable */
/**
 * Browser tests for Omni Calendar's UI (views, modals, settings, touch gestures).
 * Usage:  npm run test:ui            (all tests)
 *         npm run test:ui -- touch   (only tests whose name contains "touch")
 * Screenshots of key screens are written to tests/.out/shots/ for visual checks.
 *
 * The real plugin code is bundled against tests/ui/obsidian-mock.ts. Time is frozen at
 * 2026-11-14 10:00 (Europe/Zurich) so results are reproducible. Requires Playwright with Chromium.
 */
const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "tests/.out");
const SHOTS = path.join(OUT, "shots");
const PAGE = "file://" + path.join(__dirname, "index.html");
const ICS = fs.readFileSync(path.join(__dirname, "fixtures.ics"), "utf8");
const NOW = new Date("2026-11-14T10:00:00+01:00");
const filter = process.argv[2] || "";

const tests = [];
const test = (name, opts, fn) => tests.push({ name, opts, fn });
function expect(cond, msg) { if (!cond) throw new Error(msg); }
const eq = (a, b, msg) => expect(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

async function open(browser, { mobile = false, width, height } = {}) {
	const ctx = await browser.newContext({
		viewport: { width: width ?? (mobile ? 390 : 1400), height: height ?? (mobile ? 800 : 900) },
		hasTouch: mobile, isMobile: mobile, timezoneId: "Europe/Zurich", locale: "en-US",
	});
	const page = await ctx.newPage();
	const errors = [];
	page.on("pageerror", (e) => errors.push(String(e)));
	await page.clock.setFixedTime(NOW);
	await page.goto(PAGE);
	await page.evaluate(([ics, mobile]) => window.boot(ics, { mobile }), [ICS, mobile]);
	await page.waitForTimeout(150);
	if (mobile || (width && width < 700)) await page.evaluate(() => (document.getElementById("side").style.display = "none"));
	return { ctx, page, errors };
}
const shot = (page, name, clip) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), clip });

// ======================================================================== data / logic

test("ICS: time zones, exceptions, EXDATE, cancelled", {}, async ({ page }) => {
	const r = await page.evaluate(() => plugin.store.getOccurrences(new Date(2026, 10, 9), new Date(2026, 10, 30))
		.filter((o) => o.sourceId === "ics1").map((o) => `${o.title}|${o.start.toISOString()}|${o.allDay}`));
	eq(r.sort(), [
		"Conference|2026-11-24T23:00:00.000Z|true",
		"NY call (no VTIMEZONE)|2026-11-16T14:00:00.000Z|false",
		"UTC lunch|2026-11-17T12:00:00.000Z|false",
		"Weekly sync (Google)|2026-11-27T13:00:00.000Z|false",
		"Weekly sync (moved)|2026-11-13T15:00:00.000Z|false",
	], "ICS occurrences");
});

test("local recurrence: exclude one occurrence", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const s = plugin.data.events.find((e) => e.title === "Standup");
		const before = plugin.store.getOccurrences(new Date(2026, 0, 1), new Date(2027, 11, 31)).filter((o) => o.title === "Standup").length;
		await plugin.store.excludeOccurrence(s.id, "2026-11-15");
		const after = plugin.store.getOccurrences(new Date(2026, 0, 1), new Date(2027, 11, 31)).filter((o) => o.title === "Standup").length;
		const on15 = plugin.store.getOccurrencesForDay(new Date(2026, 10, 15)).some((o) => o.title === "Standup");
		return { before, after, on15 };
	});
	eq(r, { before: 20, after: 19, on15: false }, "recurrence");
});

// ======================================================================== desktop UI

test("desktop: all views render (screenshots)", {}, async ({ page }) => {
	for (const mode of ["month", "week", "day", "agenda"]) {
		await page.evaluate((m) => view.goTo(new Date(2026, 10, 14), m), mode);
		await page.waitForTimeout(150);
		await shot(page, `desktop-${mode}`);
		if (mode === "week") eq(await page.locator(".ch-tg-col").count(), 7, "week view columns");
		if (mode === "day") eq(await page.locator(".ch-tg-col").count(), 1, "day view columns");
		if (mode === "month") eq(await page.locator(".ch-month-cell").count(), 42, "month view cells");
		if (mode === "agenda") expect(await page.locator(".ch-agenda-item").count() > 5, "agenda lists events");
	}
});

test("desktop: drag on time grid creates exactly one dialog", {}, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.waitForTimeout(200);
	const col = await page.locator(".ch-tg-col").nth(4).boundingBox();
	const sc = await page.$eval(".ch-grid-scroll", (e) => e.getBoundingClientRect().top);
	await page.mouse.move(col.x + 20, sc + 100);
	await page.mouse.down();
	await page.mouse.move(col.x + 20, sc + 196, { steps: 5 });
	await page.mouse.up();
	await page.waitForTimeout(100);
	eq(await page.locator(".modal").count(), 1, "dialogs open");
	await page.fill(".ch-title-input", "Dragged");
	await page.click(".ch-modal-buttons button.mod-cta");
	await page.waitForTimeout(100);
	const ev = await page.evaluate(() => plugin.data.events.find((e) => e.title === "Dragged"));
	expect(ev && ev.start.startsWith("2026-11-13T"), `event created on Fri 13: ${JSON.stringify(ev)}`);
});

test("desktop: drag & drop moves a local event (month)", {}, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(150);
	const cells = page.locator(".ch-month-cell:not(.ch-other-month)");
	await page.locator(".ch-month .ch-chip", { hasText: "Gym" }).dragTo(cells.nth(24));
	await page.waitForTimeout(150);
	const gym = await page.evaluate(() => plugin.data.events.find((e) => e.title === "Gym"));
	eq([gym.start, gym.end], ["2026-11-25T18:00", "2026-11-25T19:30"], "Gym moved to the 25th");
});

test("desktop: Google event edit sends ETag, delete needs confirmation", {}, async ({ page }) => {
	await page.evaluate(() => {
		window.updates = []; window.dels = [];
		plugin.store.updateRemote = async (o, i) => window.updates.push({ id: o.remote.id, etag: o.remote.etag, title: i.title });
		plugin.store.deleteRemote = async (o, series) => window.dels.push({ id: o.remote.id, series });
		view.goTo(new Date(2026, 10, 15), "day");
	});
	await page.waitForTimeout(150);
	await page.locator(".ch-tg-event", { hasText: "Dentist" }).click();
	await page.fill(".ch-title-input", "Dentist moved");
	await page.click(".ch-modal-buttons button.mod-cta");
	await page.waitForTimeout(100);
	eq(await page.evaluate(() => window.updates), [{ id: "g1", etag: '"1"', title: "Dentist moved" }], "update call");
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "day"));
	await page.waitForTimeout(150);
	await page.locator(".ch-tg-event", { hasText: "Team lunch" }).click();
	await page.locator(".ch-modal-buttons button", { hasText: "Delete this occurrence" }).click();
	await page.waitForTimeout(100);
	eq(await page.evaluate(() => window.dels.length), 0, "not deleted before confirming");
	await page.locator(".modal .mod-warning", { hasText: "Delete" }).last().click();
	await page.waitForTimeout(100);
	eq(await page.evaluate(() => window.dels), [{ id: "g2_x", series: false }], "deleted after confirming");
});

test("desktop: new event saved to several calendars", {}, async ({ page }) => {
	await page.evaluate(() => { window.creates = []; plugin.store.createRemote = async (s, i) => window.creates.push(s.id); });
	await page.click(".ch-new-btn");
	await page.locator(".ch-target-chip", { hasText: "Mine (Google)" }).click();
	await page.fill(".ch-title-input", "Multi");
	await page.click(".ch-modal-buttons button.mod-cta");
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => window.creates), ["gcal"], "remote copy");
	eq(await page.evaluate(() => plugin.data.events.filter((e) => e.title === "Multi").map((e) => e.calendarId)), ["personal"], "local copy");
});

test("desktop: settings tabs and calendar menu", {}, async ({ page }) => {
	await page.evaluate(() => { const m = document.getElementById("main"); m.innerHTML = ""; tab.display(); m.appendChild(tab.containerEl); });
	const expected = { 0: "New events", 1: "Google & Outlook accounts", 2: "Calendar", 3: "Event notes" };
	for (let i = 0; i < 4; i++) {
		await page.locator(".ch-settings-tab").nth(i).click();
		await page.waitForTimeout(80);
		const first = await page.$eval(".ch-settings-body .setting-item-heading .setting-item-name", (e) => e.textContent);
		eq(first, expected[i], `tab ${i} first heading`);
		await shot(page, `settings-tab-${i}`);
	}
	const r = await page.evaluate(() => {
		let opened = ""; plugin.app.setting = { open() { opened += "open"; }, openTabById(id) { opened += ":" + id; } };
		plugin.showCalendarMenu({ x: 10, y: 10 });
		window.lastMenu.items.find((i) => i.t === "Settings").fn();
		return { items: window.lastMenu.items.map((i) => i.t), opened };
	});
	eq(r.opened, "open:omni-calendar", "Settings menu entry opens plugin settings");
});

test("desktop: sidebar setting (Off / Mini / Full, side, user closes)", {}, async ({ page }) => {
	const out = await page.evaluate(async () => {
		const snap = () => ws.leaves.filter((l) => l.root.name !== "main").map((l) => `${l.root.name}:${String(l.vs.type).replace("omni-calendar-", "")}`).join(" ") || "-";
		const res = {};
		plugin.settings.sidebarView = "full"; plugin.settings.sidebarSide = "left"; await plugin.applySidebar(true); res.full = snap();
		plugin.settings.sidebarSide = "right"; await plugin.applySidebar(true); res.right = snap();
		plugin.settings.sidebarView = "none"; await plugin.applySidebar(true); res.off = snap();
		await plugin.toggleSidebar("mini"); res.toggle = snap() + "/" + plugin.settings.sidebarView;
		await new Promise((r) => setTimeout(r, 350));
		ws.leaves.find((l) => l.root.name === "right").detach(); ws.fireLayoutChange(); res.closed = snap() + "/" + plugin.settings.sidebarView;
		res.mainKept = ws.leaves.some((l) => l.root.name === "main");
		return res;
	});
	eq(out, { full: "left:view", right: "right:view", off: "-", toggle: "right:mini/mini", closed: "-/none", mainKept: true }, "sidebar model");
});

test("desktop: responsive month/week at narrow widths", { width: 360 }, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(200);
	expect(await page.locator(".ch-month-cards").count() === 1, "month uses day cards when narrow");
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.waitForTimeout(200);
	expect(await page.locator(".ch-tg-hscroll").count() === 1, "week scrolls sideways when narrow");
});

// ======================================================================== mobile UI

test("mobile: ribbon tap opens the menu (not the calendar)", { mobile: true }, async ({ page }) => {
	const r = await page.evaluate(() => {
		let opened = 0; plugin.openCalendar = async () => { opened++; };
		window.menuShows = 0; window.ribbonEl.click();
		return { opened, menus: window.menuShows, title: window.ribbonEl.title, first: window.lastMenu.items[0].t };
	});
	eq(r, { opened: 0, menus: 1, title: "Omni Calendar", first: "Open full calendar" }, "ribbon");
});

test("mobile touch: tap, long-press drag, double tap, cancelled gesture", { mobile: true }, async ({ page, ctx }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 18), "day"));
	await page.waitForTimeout(250);
	const cdp = await ctx.newCDPSession(page);
	const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
	const col = await page.locator(".ch-tg-col").first().boundingBox();
	const sc = await page.$eval(".ch-grid-scroll", (e) => e.getBoundingClientRect().top);
	const x = col.x + col.width / 2, y = sc + 200;
	const state = () => page.evaluate(() => ({ modals: document.querySelectorAll(".modal").length, ghosts: document.querySelectorAll(".ch-tg-selection").length }));
	const close = () => page.evaluate(() => document.querySelectorAll(".modal-container").forEach((m) => { m.remove(); }) || window.lastModal?.onClose?.());

	await touch("touchStart", x, y); await page.waitForTimeout(60); await touch("touchEnd"); await page.waitForTimeout(150);
	eq(await state(), { modals: 1, ghosts: 0 }, "tap"); await page.evaluate(() => window.lastModal.close());

	await touch("touchStart", x, y); await page.waitForTimeout(550);
	for (let i = 1; i <= 6; i++) { await touch("touchMove", x, y + i * 16); await page.waitForTimeout(15); }
	eq((await state()).ghosts, 1, "selection visible during long-press drag");
	await touch("touchEnd"); await page.waitForTimeout(150);
	eq(await state(), { modals: 1, ghosts: 0 }, "long-press drag"); await page.evaluate(() => window.lastModal.close());

	await touch("touchStart", x, y); await touch("touchEnd"); await page.waitForTimeout(30);
	await touch("touchStart", x, y + 50); await touch("touchEnd"); await page.waitForTimeout(150);
	eq((await state()).modals, 1, "double tap opens only one dialog"); await page.evaluate(() => window.lastModal.close());

	await page.evaluate(() => {
		const c = document.querySelector(".ch-tg-col");
		c.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 7, pointerType: "touch", isPrimary: true, button: 0, clientX: 100, clientY: 300, bubbles: true }));
		window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 7, pointerType: "touch", bubbles: true }));
	});
	await page.waitForTimeout(500);
	eq(await state(), { modals: 0, ghosts: 0 }, "cancelled gesture leaves nothing");
	void close;
});

test("mobile week: whole week, swipe, alignment, week bar", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 9), "week"));
	await page.waitForTimeout(300);
	const info = () => page.evaluate(() => {
		const w = document.querySelector(".ch-tg-hscroll"), sc = document.querySelector(".ch-grid-scroll");
		const dayW = parseFloat(w.style.getPropertyValue("--ch-day-w"));
		const heads = [...document.querySelectorAll(".ch-tg-dayhead")], cols = [...document.querySelectorAll(".ch-tg-col")];
		let mis = 0; cols.forEach((c, i) => (mis = Math.max(mis, Math.abs(heads[i].getBoundingClientRect().left - c.getBoundingClientRect().left))));
		return { cols: cols.length, first: cols[Math.round(sc.scrollLeft / dayW)].dataset.date, misalign: Math.round(mis),
			bar: [...document.querySelectorAll(".ch-week-bar-seg")].map((s) => (s.classList.contains("is-visible") ? "■" : "□")).join(""),
			title: document.querySelector(".ch-title").textContent };
	});
	const a = await info();
	eq([a.cols, a.first, a.misalign, a.bar, a.title], [7, "2026-11-09", 0, "■■■■□□□", "November 2026 · W46"], "start of week");
	await page.evaluate(() => { const sc = document.querySelector(".ch-grid-scroll"); sc.scrollLeft = sc.scrollWidth; });
	await page.waitForTimeout(300);
	const b = await info();
	eq([b.misalign, b.bar], [0, "□□□■■■■"], "end of week");
	await shot(page, "mobile-week-end", { x: 0, y: 0, width: 390, height: 400 });
});

test("mobile: settings tabs stay on one line and scroll", { mobile: true, width: 340 }, async ({ page }) => {
	await page.evaluate(() => { const m = document.getElementById("main"); m.innerHTML = ""; tab.display(); m.appendChild(tab.containerEl); });
	await page.waitForTimeout(150);
	const r = await page.evaluate(() => {
		const bar = document.querySelector(".ch-settings-tabs");
		return { oneLine: new Set([...bar.children].map((c) => Math.round(c.getBoundingClientRect().top))).size === 1,
			scrollable: bar.scrollWidth > bar.clientWidth, nextArrow: !document.querySelector(".ch-tabs-next").classList.contains("is-hidden") };
	});
	eq(r, { oneLine: true, scrollable: true, nextArrow: true }, "tab bar");
});

test("mobile: week numbers in narrow layouts", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => { plugin.settings.showWeekNumbers = true; view.goTo(new Date(2026, 10, 14), "month"); });
	await page.waitForTimeout(200);
	eq(await page.$$eval(".ch-week-divider", (d) => d.map((x) => x.textContent)), ["Week 44", "Week 45", "Week 46", "Week 47", "Week 48", "Week 49"], "month dividers");
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "day"));
	await page.waitForTimeout(150);
	expect((await page.textContent(".ch-title")).endsWith("· W46"), "day title has week number");
});

// ======================================================================== runner

(async () => {
	fs.mkdirSync(SHOTS, { recursive: true });
	await esbuild.build({
		entryPoints: [path.join(__dirname, "entry.ts")], bundle: true, format: "iife", outfile: path.join(OUT, "ui-bundle.js"),
		alias: { obsidian: path.join(__dirname, "obsidian-mock.ts") }, external: ["http"], logLevel: "error",
		define: { __OMNI_GOOGLE_CLIENT_ID__: '""', __OMNI_GOOGLE_CLIENT_SECRET__: '""' },
	});
	const browser = await chromium.launch();
	let failed = 0, ran = 0;
	for (const t of tests) {
		if (filter && !t.name.includes(filter)) continue;
		ran++;
		const env = await open(browser, t.opts);
		try {
			await t.fn(env);
			const errs = env.errors.filter((e) => !/getRightLeaf|getLeftLeaf/.test(e));
			expect(!errs.length, `page errors: ${errs.join(" | ")}`);
			console.log(`PASS  ${t.name}`);
		} catch (e) {
			failed++;
			console.log(`FAIL  ${t.name}\n      ${e.message.split("\n")[0]}`);
			await shot(env.page, `FAIL-${t.name.replace(/[^\w]+/g, "_")}`).catch(() => {});
		}
		await env.ctx.close();
	}
	await browser.close();
	console.log(`\n${ran - failed}/${ran} passed${failed ? ` – ${failed} failed (see tests/.out/shots/FAIL-*.png)` : ""}`);
	process.exit(failed ? 1 : 0);
})();
