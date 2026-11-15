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
	const preview = await page.evaluate(() => {
		const g = document.querySelector(".ch-tg-selection");
		return g && { time: g.querySelector(".ch-tg-selection-time").textContent, title: g.querySelector(".ch-tg-selection-title").textContent,
			color: getComputedStyle(g).getPropertyValue("--ch-event-color").trim() };
	});
	expect(preview && /^\d\d:\d\d – \d\d:\d\d$/.test(preview.time), `preview shows the time range: ${JSON.stringify(preview)}`);
	eq(preview.title, "New event", "preview title");
	eq(preview.color, await page.evaluate(() => plugin.settings.sources.find((s) => s.id === plugin.settings.defaultTargets[0]).color), "preview uses target calendar colour");
	await page.locator(".ch-tg-col").nth(4).screenshot({ path: path.join(SHOTS, "drag-preview.png") });
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
	const expected = { 0: "New events", 1: "Google & Outlook accounts", 2: "Calendar", 3: "Tasks", 4: "Event notes" };
	for (let i = 0; i < 5; i++) {
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

test("desktop: day planner in sidebar opens in Day view and remembers its own view", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const out = {};
		plugin.settings.defaultView = "month";
		await plugin.toggleSidebar("full");
		const leaf = plugin.sidebarLeaves("omni-calendar-view")[0];
		out.opens = leaf.getViewState().state.mode;
		const L0 = ws.mk(ws.rightSplit); L0.app = plugin.app; const V0 = new view.constructor(L0, plugin);
		out.titles = [view.getDisplayText(), V0.getDisplayText(), mini.getDisplayText()];
		// a real view inside a sidebar leaf: switching to Week is remembered, the main view is not affected
		const L = ws.mk(ws.rightSplit); L.app = plugin.app;
		const V = new view.constructor(L, plugin); await V.onOpen();
		[...V.contentEl.querySelectorAll(".ch-segmented button")].find((b) => b.textContent === "Week").click();
		out.remembered = plugin.settings.sidebarCalendarMode;
		[...view.contentEl.querySelectorAll(".ch-segmented button")].find((b) => b.textContent === "Agenda").click();
		out.afterMain = plugin.settings.sidebarCalendarMode;
		await plugin.toggleSidebar("full"); for (const l of plugin.sidebarLeaves("omni-calendar-view")) l.detach();
		await plugin.toggleSidebar("full");
		out.reopens = plugin.sidebarLeaves("omni-calendar-view")[0].getViewState().state.mode;
		tab.constructor.tab = "display"; tab.display();
		out.label = [...tab.containerEl.querySelectorAll("option")].find((o) => o.value === "full")?.text ?? null;
		return out;
	});
	eq(r.titles, ["Calendar", "Day planner", "Mini calendar"], "tab titles match the names in menus and settings");
	delete r.titles;
	eq(r, { opens: "day", remembered: "week", afterMain: "week", reopens: "week", label: "Day planner" }, "day planner");
});

test("desktop: ⤢ in the Day planner – switch to mini (default), close, or keep", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const run = async (after) => {
			if (after) plugin.settings.sidebarOnExpand = after;
			plugin.settings.sidebarView = "full"; await plugin.applySidebar(false);
			const L = plugin.sidebarLeaves("omni-calendar-view")[0]; L.app = plugin.app;
			const V = new view.constructor(L, plugin); await V.onOpen();
			const btn = V.contentEl.querySelector('[aria-label^="Open calendar"]');
			const label = btn.getAttribute("aria-label");
			btn.click(); await new Promise((r) => setTimeout(r, 50));
			ws.fireLayoutChange(); // Obsidian fires this right after; must not undo the change
			const main = ws.leaves.filter((l) => l.root === ws.rootSplit && l.vs.type === "omni-calendar-view").length;
			const miniLeaves = plugin.sidebarLeaves("omni-calendar-mini");
			return { label, setting: plugin.settings.sidebarView, mini: miniLeaves.length, sameTab: miniLeaves[0] === L,
				planner: plugin.sidebarLeaves("omni-calendar-view").length, main: main > 0 };
		};
		return { def: plugin.settings.sidebarOnExpand, mini: await run(), close: await run("close"), keep: await run("keep") };
	});
	eq(r.def, "mini", "default");
	eq(r.mini, { label: "Open calendar (the sidebar switches to the mini calendar)", setting: "mini", mini: 1, sameTab: true, planner: 0, main: true }, "switch to mini");
	eq(r.close, { label: "Open calendar (closes the day planner)", setting: "none", mini: 0, sameTab: false, planner: 0, main: true }, "close");
	eq(r.keep, { label: "Open calendar (keeps the day planner)", setting: "full", mini: 0, sameTab: false, planner: 1, main: true }, "keep");
});

test("desktop: Day planner 'Close' → chosen sidebar tab is shown (left and right)", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const add = (root, type, title) => { const l = ws.mk(root); l.vs = { type, state: {} }; l.title = title; return l; };
		add(ws.rightSplit, "backlink", "Backlinks"); const bm = add(ws.rightSplit, "bookmarks", "Bookmarks");
		add(ws.leftSplit, "file-explorer", "Files"); const se = add(ws.leftSplit, "search", "Search");
		const out = {};
		const settingRows = () => { tab.constructor.tab = "display"; tab.display();
			const row = [...tab.containerEl.querySelectorAll(".setting-item")].find((x) => /Then show this sidebar tab/.test(x.textContent));
			return row ? [...row.querySelectorAll("option")].map((o) => o.text) : null; };
		plugin.settings.sidebarOnExpand = "mini";
		out.hiddenForMini = settingRows();
		plugin.settings.sidebarOnExpand = "close";
		const press = async () => {
			plugin.settings.sidebarView = "full"; await plugin.applySidebar(false);
			const L = plugin.sidebarLeaves("omni-calendar-view")[0]; L.app = plugin.app;
			const V = new view.constructor(L, plugin); await V.onOpen();
			V.contentEl.querySelector('[aria-label^="Open calendar"]').click(); await new Promise((r) => setTimeout(r, 50));
		};
		plugin.settings.sidebarSide = "right"; out.rightOpts = settingRows();
		plugin.settings.sidebarAfterClose = "bookmarks"; await press();
		out.right = ws.tabGroups.right.selected === bm;
		plugin.settings.sidebarSide = "left"; out.leftOpts = settingRows();
		plugin.settings.sidebarAfterClose = "search"; await press();
		out.left = ws.tabGroups.left.selected === se;
		out.planner = plugin.sidebarLeaves("omni-calendar-view").length;
		return out;
	});
	eq(r.hiddenForMini, null, "extra setting only with Close");
	eq(r.rightOpts, ["Let Obsidian decide", "Backlinks", "Bookmarks"], "right sidebar tabs");
	eq(r.leftOpts, ["Let Obsidian decide", "Files", "Search", "Bookmarks (not in the left sidebar right now)"], "left sidebar tabs (+ saved choice from the right)");
	eq([r.right, r.left, r.planner], [true, true, 0], "chosen tab shown, planner closed");
});

test("desktop: settings keep their scroll position, don't reveal the sidebar, defaults", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const out = {};
		const fresh = new plugin.constructor(plugin.app); await fresh.loadPluginData?.call(fresh);
		out.defaults = [fresh.settings?.sidebarOnExpand, fresh.settings?.sidebarAfterClose];
		const box = document.createElement("div");
		box.style.cssText = "position:fixed;left:0;top:0;width:600px;height:300px;overflow:auto;background:rgb(250, 250, 250);z-index:200";
		document.body.appendChild(box); box.appendChild(tab.containerEl);
		tab.constructor.tab = "display"; tab.display();
		tab.containerEl.style.padding = "24px 32px";
		box.scrollTop = 400; const before = box.scrollTop;
		const row = (re) => [...tab.containerEl.querySelectorAll(".setting-item")].find((x) => re.test(x.textContent));
		const sel = row(/When the day planner opens/).querySelector("select");
		sel.value = "close"; sel.dispatchEvent(new Event("change")); await new Promise((r) => setTimeout(r, 50));
		out.kept = Math.abs(box.scrollTop - before) < 2 && before > 0;
		out.subShown = !!row(/Then show this sidebar tab/);
		out.afterCloseDefault = row(/Then show this sidebar tab/).querySelector("select").value;
		ws.reveals = 0;
		const side = row(/Calendar in sidebar/).querySelector("select");
		side.value = "mini"; side.dispatchEvent(new Event("change")); await new Promise((r) => setTimeout(r, 50));
		out.reveals = ws.reveals;
		const mini = plugin.sidebarLeaves("omni-calendar-mini")[0];
		out.miniSelected = !!mini && mini.parent.selected === mini;
		const wrap = tab.containerEl.querySelector(".ch-settings-tabs-wrap");
		out.bg = getComputedStyle(wrap, "::before").backgroundColor;
		const b2 = box.scrollTop; tab.containerEl.querySelectorAll(".ch-settings-tab")[0].click();
		out.tabSwitchTop = box.scrollTop === 0 && b2 > 0;
		return out;
	});
	await page.evaluate(() => { tab.containerEl.parentElement.scrollTop = 250; });
	await page.screenshot({ path: path.join(SHOTS, "settings-scrolled.png"), clip: { x: 0, y: 0, width: 600, height: 300 } });
	eq(r.defaults, ["mini", ""], "defaults: switch to mini, let Obsidian decide");
	eq(r.kept, true, "scroll position kept after a change");
	eq([r.subShown, r.afterCloseDefault], [true, ""], "'Close' shows sub-setting with 'Let Obsidian decide'");
	eq([r.reveals, r.miniSelected], [0, true], "sidebar changed without revealing / closing settings");
	eq(r.bg, "rgb(250, 250, 250)", "tab bar background covers its surroundings");
	eq(r.tabSwitchTop, true, "switching tabs starts at the top");
});

// ======================================================================== tasks (1.7)

/** Create tasks around "today" (2026-11-14) for the tasks tests. */
const seedTasks = () => page => page.evaluate(async () => {
	const S = plugin.tasks;
	const add = (o) => S.upsert(S.draft(o));
	await add({ title: "Low prio today", date: "2026-11-14", priority: 1 });
	await add({ title: "High prio today", date: "2026-11-14", priority: 3, start: "10:30", end: "11:00" });
	await add({ title: "Untimed medium today", date: "2026-11-14", priority: 2 });
	await add({ title: "Overdue thing", date: "2026-11-10" });
	await add({ title: "Tomorrow thing", date: "2026-11-15", start: "09:00" });
	await add({ title: "Next week thing", date: "2026-11-19" });
	await add({ title: "Far away", date: "2026-12-24" });
	await add({ title: "Someday", subtasks: [{ id: "s1", title: "Step one", done: true }, { id: "s2", title: "Step two", done: false }] });
});

test("desktop: tasks page – smart lists, sorting, quick add, tick off", {}, async ({ page }) => {
	await seedTasks()(page);
	await page.evaluate(() => mountTasks());
	await page.waitForTimeout(150);
	const titles = () => page.$$eval(".ch-tasks-main .ch-tasks-group:not(.ch-tasks-done-group) .ch-task-title", (e) => e.map((x) => x.textContent));
	const groups = () => page.$$eval(".ch-tasks-main .ch-tasks-group-head > span:first-child", (e) => e.map((x) => x.textContent));
	// Today: overdue first, then today's tasks by priority
	eq(await groups(), ["Overdue", "Today"], "today groups");
	eq(await titles(), ["Overdue thing", "High prio today", "Untimed medium today", "Low prio today"], "today order (priority, then time)");
	eq(await page.$eval('[data-list="overdue"] .ch-tasks-nav-count', (e) => e.textContent), "1", "overdue count");
	const meta = await page.$eval('.ch-task:has(.ch-task-title:text("High prio today"))', (e) => e.textContent).catch(() => null)
		?? await page.evaluate(() => [...document.querySelectorAll(".ch-task")].find((x) => x.textContent.includes("High prio"))?.textContent);
	expect(/10:30–11:00/.test(meta) && /!!!/.test(meta), "time range + priority shown: " + meta);
	await shot(page, "tasks-desktop-today");
	// Quick add into Today
	await page.fill(".ch-tasks-quick", "Quick one");
	await page.press(".ch-tasks-quick", "Enter");
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => plugin.tasks.items.find((t) => t.title === "Quick one")?.date), "2026-11-14", "quick add gets today's date");
	// Tick off → moves to collapsed Done
	await page.evaluate(() => [...document.querySelectorAll(".ch-task")].find((x) => x.textContent.includes("Low prio today")).querySelector(".ch-task-checkbox").click());
	await page.waitForTimeout(150);
	expect(!(await titles()).includes("Low prio today"), "done task left the open list");
	eq(await page.$eval(".ch-tasks-done-group .ch-tasks-group-count", (e) => e.textContent).catch(() => null), null, "smart list Today has no Done section (only user lists / All)");
	// Upcoming: one heading per day
	await page.click('[data-list="upcoming"]');
	await page.waitForTimeout(100);
	eq(await groups(), ["Today", "Tomorrow", "Thursday, November 19"], "upcoming grouped by day");
	await shot(page, "tasks-desktop-upcoming");
	// No date + subtasks inline, All with Done section
	await page.click('[data-list="nodate"]');
	await page.waitForTimeout(100);
	eq(await titles(), ["Someday"], "no date list");
	eq(await page.$$eval(".ch-task-sub-title", (e) => e.map((x) => x.textContent)), ["Step one", "Step two"], "subtasks inline");
	await page.click(".ch-task-sub .ch-task-checkbox >> nth=1");
	await page.waitForTimeout(100);
	eq(await page.evaluate(() => plugin.tasks.items.find((t) => t.title === "Someday").subtasks.map((s) => s.done)), [true, true], "subtask ticked");
	await page.click('[data-list="all"]');
	await page.waitForTimeout(100);
	eq(await groups(), ["Overdue", "Today", "Tomorrow", "Thursday, November 19", "Later", "No date", "Done"], "all: groups incl. collapsed Done");
	eq(await page.evaluate(() => document.querySelector(".ch-tasks-done-group").open), false, "Done collapsed");
	await page.click('[data-list="done"]');
	await page.waitForTimeout(100);
	eq(await titles(), ["Low prio today"], "done list");
});

test("desktop: task dialog – priority, date, time range, subtasks, linked notes", {}, async ({ page }) => {
	await page.evaluate(() => mountTasks());
	await page.waitForTimeout(100);
	await page.click(".ch-tasks-new");
	await page.waitForTimeout(100);
	await page.fill(".ch-task-modal .ch-title-input", "Prepare workshop");
	await page.click(".ch-prio-seg .ch-prio-3");
	await page.click('.ch-task-quick button:text("Tomorrow")');
	expect(await page.isVisible(".ch-task-time-setting"), "time row visible once a date is set");
	await page.fill(".ch-task-start", "10:30");
	await page.dispatchEvent(".ch-task-start", "change");
	await page.fill(".ch-task-end", "11:45");
	await page.dispatchEvent(".ch-task-end", "change");
	await page.fill(".ch-task-add-sub", "Book room");
	await page.press(".ch-task-add-sub", "Enter");
	await page.fill(".ch-task-add-sub", "Print handouts");
	await page.press(".ch-task-add-sub", "Enter");
	// link two notes: search + create
	const pick = async (q, pickCreate) => page.evaluate(async ([q, pickCreate]) => {
		const m = window.lastModal; const s = m.getSuggestions(q);
		await m.onChooseSuggestion(pickCreate ? s.find((x) => x.create) : s[0]);
		return s.map((x) => x.create ? `+${x.create}` : x.basename);
	}, [q, pickCreate]);
	await page.click(".ch-task-link-btn");
	eq(await pick("website", false), ["Website notes", "Website relaunch", "+website"], "note search (+ create option)");
	await page.evaluate(() => window.lastModal.close());
	await page.evaluate(() => [...document.querySelectorAll(".ch-task-link-btn")].pop().click());
	await pick("Workshop plan", true);
	await page.evaluate(() => window.lastModal.close());
	eq(await page.$$eval(".ch-task-link-name", (e) => e.map((x) => x.textContent)), ["Website notes", "Workshop plan"], "links listed in dialog");
	await page.screenshot({ path: path.join(SHOTS, "task-dialog.png") });
	await page.evaluate(() => [...document.querySelectorAll(".ch-task-modal .ch-modal-buttons button.mod-cta")].pop().click());
	await page.waitForTimeout(150);
	const t = await page.evaluate(() => plugin.tasks.items.find((x) => x.title === "Prepare workshop"));
	eq([t.priority, t.date, t.start, t.end, t.subtasks.map((s) => s.title), t.links], [3, "2026-11-15", "10:30", "11:45", ["Book room", "Print handouts"], ["Projects/Website notes.md", "Calendar/Workshop plan.md"]], "saved task");
	// shown in Tomorrow with link chips; chip opens the note
	await page.click('[data-list="tomorrow"]');
	await page.waitForTimeout(100);
	eq(await page.$$eval(".ch-task-linkchip", (e) => e.map((x) => x.textContent)), ["Website notes", "Workshop plan"], "link chips");
	await page.click(".ch-task-linkchip >> nth=0");
	eq(await page.evaluate(() => window.openedFile), "Projects/Website notes.md", "chip opens note");
	expect((await page.textContent(".ch-task-meta")).includes("0/2"), "subtask progress");
	// rename / delete follow
	await page.evaluate(() => { plugin.tasks.renameLink("Projects/Website notes.md", "Archive/Website notes.md"); plugin.tasks.removeLink("Calendar/Workshop plan.md"); });
	eq(await page.evaluate(() => plugin.tasks.items.find((x) => x.title === "Prepare workshop").links), ["Archive/Website notes.md"], "links follow rename/delete");
	await page.screenshot({ path: path.join(SHOTS, "tasks-desktop-tomorrow.png") });
});

test("desktop: task lists – create, add into list, delete moves tasks", {}, async ({ page }) => {
	await page.evaluate(() => mountTasks());
	await page.waitForTimeout(100);
	await page.click('.ch-tasks-nav-head button');
	await page.fill(".ch-list-modal input:not([type=color])", "Work");
	await page.evaluate(() => [...document.querySelectorAll(".ch-list-modal .mod-cta")].pop().click());
	await page.waitForTimeout(150);
	eq(await page.textContent(".ch-tasks-title"), "Work", "new list selected");
	await page.fill(".ch-tasks-quick", "Write report");
	await page.press(".ch-tasks-quick", "Enter");
	await page.waitForTimeout(150);
	const r = await page.evaluate(() => { const l = plugin.tasks.lists.find((x) => x.name === "Work"); const t = plugin.tasks.items.find((x) => x.title === "Write report"); return { inList: t.listId === l.id, date: t.date ?? null, id: l.id }; });
	eq([r.inList, r.date], [true, null], "quick add in a list: that list, no date");
	await page.evaluate((id) => plugin.tasks.removeList(id), r.id);
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => [plugin.tasks.items.find((x) => x.title === "Write report").listId, document.querySelector(".ch-tasks-title").textContent]), ["tasks", "Today"], "tasks moved to default list, view back to Today");
	eq(await page.evaluate(() => plugin._data.tasks.lists.map((l) => l.name)), ["Tasks"], "saved in data.json");
});

test("desktop: tasks sidebar toggle, main switch, menu entries, settings tab", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const out = {};
		const menu = () => { plugin.showCalendarMenu({ x: 1, y: 1 }); return window.lastMenu.items.map((i) => i.t); };
		window.__ts = 0; // reset ribbon double-show guard
		plugin.ribbonMenuShownAt = 0; out.menuOn = menu().filter((t) => /task/i.test(t));
		await plugin.toggleTasksSidebar();
		out.sidebar = plugin.sidebarLeaves("omni-calendar-tasks").map((l) => l.getRoot().name);
		out.setting = plugin.settings.tasksSidebar;
		plugin.settings.tasksEnabled = false; await plugin.applyTasksSidebar(false);
		out.afterOff = plugin.app.workspace.getLeavesOfType("omni-calendar-tasks").length;
		plugin.ribbonMenuShownAt = 0; out.menuOff = menu().filter((t) => /task/i.test(t));
		tab.constructor.tab = "tasks"; tab.display();
		out.offRows = [...tab.containerEl.querySelectorAll(".setting-item-name")].map((e) => e.textContent);
		out.kept = plugin.tasks.lists.length;
		return out;
	});
	eq(r.menuOn, ["Open tasks", "Show tasks in sidebar", "New task"], "menu with tasks on");
	eq([r.sidebar, r.setting], [["right"], true], "tasks in right sidebar");
	eq(r.afterOff, 0, "main switch off closes tasks pages");
	eq(r.menuOff, [], "no task menu entries when off");
	eq(r.offRows, ["Tasks", "Use tasks"], "settings tab shows only the switch when off");
	await page.evaluate(() => { plugin.settings.tasksEnabled = true; const m = document.getElementById("main"); m.innerHTML = ""; tab.display(); m.appendChild(tab.containerEl); });
	await shot(page, "settings-tab-tasks");
});

test("mobile: tasks page – list bar, no sideways scrolling, dialog fits", { mobile: true }, async ({ page }) => {
	await seedTasks()(page);
	await page.evaluate(() => mountTasks());
	await page.waitForTimeout(200);
	const r = await page.evaluate(() => {
		const main = document.querySelector(".ch-tasks-main");
		return { bar: !!document.querySelector(".ch-tasks-bar"), nav: !!document.querySelector(".ch-tasks-nav"),
			overflow: main.scrollWidth > main.clientWidth + 1, barScrolls: document.querySelector(".ch-tasks-bar").scrollWidth > document.querySelector(".ch-tasks-bar").clientWidth };
	});
	eq(r, { bar: true, nav: false, overflow: false, barScrolls: true }, "narrow layout");
	await page.screenshot({ path: path.join(SHOTS, "tasks-mobile.png") });
	await page.tap('[data-list="nodate"]');
	await page.waitForTimeout(100);
	eq(await page.textContent(".ch-tasks-title"), "No date", "tap selects list");
	await page.tap(".ch-task .ch-task-title");
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => { const m = document.querySelector(".ch-task-modal"); return m && m.scrollWidth <= m.clientWidth + 1; }), true, "dialog opens without sideways overflow");
	await page.screenshot({ path: path.join(SHOTS, "task-dialog-mobile.png") });
});

test("data: task data is normalised on load", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const { normalizeTaskData } = window.__tasksMod ?? {};
		plugin._data = { settings: plugin.settings, events: [], tasks: { lists: [{ id: "w", name: "Work", color: "#123456" }], items: [
			{ id: "a", title: "ok", listId: "w", priority: 9, date: "2026-11-14", start: "10:00", end: "09:00", subtasks: [{ id: "x", title: "s" }, null], links: ["a.md", 3] },
			{ id: "b", title: "orphan", listId: "gone", start: "10:00" }, null ] } };
		await plugin.loadPluginData();
		return { lists: plugin.data.tasks.lists.map((l) => l.id), a: plugin.data.tasks.items[0], b: plugin.data.tasks.items[1] };
	});
	eq(r.lists, ["tasks", "w"], "default list added");
	eq([r.a.priority, r.a.subtasks.length, r.a.links], [0, 1, ["a.md"]], "bad fields fixed");
	eq([r.b.listId, r.b.start ?? null], ["tasks", null], "orphan → default list, time without date dropped");
});

test("desktop: responsive month/week at narrow widths", { width: 360 }, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(200);
	expect(await page.locator(".ch-month-compact").count() === 1, "month uses the compact grid when narrow");
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.waitForTimeout(200);
	expect(await page.locator(".ch-tg-hscroll").count() === 1, "week scrolls sideways when narrow");
});

// ======================================================================== mobile UI

test("mini calendar: upcoming range setting and wording", {}, async ({ page }) => {
	const read = () => page.evaluate(() => {
		const sec = [...document.querySelectorAll("#side .ch-mini-section")].find((e) => e.textContent.startsWith("Upcoming"));
		return sec ? { head: sec.querySelector(".ch-mini-section-head").textContent, items: sec.querySelectorAll(".ch-mini-item").length,
			empty: sec.querySelector(".ch-empty")?.textContent ?? null } : null;
	});
	const set = async (n) => { await page.evaluate(async (n) => { plugin.settings.sidebarUpcomingDays = n; plugin.store.notify(); }, n); await page.waitForTimeout(100); };
	await set(7);
	const seven = await read();
	eq(seven.head, "Upcoming · in the next 7 days", "7-day header");
	await set(30);
	const thirty = await read();
	eq(thirty.head, "Upcoming · in the next month", "30-day header");
	await page.locator("#side").screenshot({ path: path.join(SHOTS, "mini-upcoming.png") });
	expect(thirty.items > seven.items, `30 days shows more (${thirty.items} > ${seven.items})`);
	await set(-1);
	eq((await read()).head, "Upcoming · in the next month", "same as agenda (30)");
	await page.evaluate(() => { plugin.settings.agendaDays = 14; });
	await set(-1);
	eq((await read()).head, "Upcoming · in the next 2 weeks", "follows agenda length");
	await page.evaluate(() => mini.selected = new Date(2027, 4, 31));
	await set(1);
	eq((await read()).empty, "Nothing planned tomorrow", "empty text uses the range");
	await set(0);
	eq(await read(), null, "0 hides the list");
	// settings dropdown
	const opts = await page.evaluate(() => { tab.display(); document.body.appendChild(tab.containerEl);
		[...tab.containerEl.querySelectorAll(".ch-settings-tab, button")].find((b) => /Display/.test(b.textContent))?.click();
		const row = [...tab.containerEl.querySelectorAll(".setting-item")].find((r) => /Upcoming list/.test(r.textContent));
		return row ? [...row.querySelectorAll("option")].map((o) => o.value) : null; });
	expect(opts && opts.includes("30") && opts.includes("-1"), "dropdown offers 30 days and same-as-agenda: " + JSON.stringify(opts));
});

test("mobile: ribbon tap opens the menu (not the calendar)", { mobile: true }, async ({ page }) => {
	const r = await page.evaluate(() => {
		let opened = 0; plugin.openCalendar = async () => { opened++; };
		window.menuShows = 0; window.ribbonEl.click();
		return { opened, menus: window.menuShows, title: window.ribbonEl.title, first: window.lastMenu.items[0].t };
	});
	eq(r, { opened: 0, menus: 1, title: "Omni Calendar", first: "Open calendar" }, "ribbon");
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

test("mobile: compact month grid with bars, selected day list", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(200);
	const r = await page.evaluate(() => ({
		layout: document.querySelector(".ch-month-compact")?.className,
		cells: document.querySelectorAll(".ch-mc-row:not(.ch-mc-head) .ch-mc-cell").length,
		selected: document.querySelector(".ch-mc-cell.ch-selected .ch-mc-num")?.textContent,
		listTitle: document.querySelector(".ch-mc-day-title")?.textContent,
		items: [...document.querySelectorAll(".ch-mc-item .ch-chip-title")].map((e) => e.textContent),
		overflowX: document.querySelector(".ch-body").scrollWidth > document.querySelector(".ch-body").clientWidth,
	}));
	expect(/ch-bars/.test(r.layout), "phone width uses title bars: " + r.layout);
	eq(r.cells, 42, "6 weeks for November 2026 (Mon-first)");
	eq(r.selected, "14", "today selected");
	expect(/14/.test(r.listTitle), "list shows today: " + r.listTitle);
	expect(r.items.includes("Design review") && r.items.includes("Standup"), "today's events listed: " + JSON.stringify(r.items));
	eq(r.overflowX, false, "no sideways scrolling");
	await page.screenshot({ path: path.join(SHOTS, "mobile-month.png") });
	// tap another day: selects it, stays in month view
	const cell = page.locator(".ch-mc-cell", { hasText: "17" }).first();
	await cell.tap();
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => [view.mode, document.querySelector(".ch-mc-cell.ch-selected .ch-mc-num").textContent]), ["month", "17"], "tap selects day");
	expect((await page.textContent(".ch-mc-day")).includes("Vacation"), "list shows the 17th");
	// heading opens the day view
	await page.click(".ch-mc-day-title");
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => view.mode), "day", "heading opens day view");
});

test("desktop: very narrow month uses dots", { width: 560 }, async ({ page }) => {
	await page.evaluate(() => { document.getElementById("main").style.flex = "none"; document.getElementById("main").style.width = "260px"; view.handleResize(); view.goTo(new Date(2026, 10, 14), "month"); });
	await page.waitForTimeout(250);
	const r = await page.evaluate(() => ({ cls: document.querySelector(".ch-month-compact")?.className, dots: document.querySelectorAll(".ch-mc-dot").length }));
	expect(/ch-dots/.test(r.cls) && r.dots > 10, "dots layout: " + JSON.stringify(r));
	await page.locator("#main").screenshot({ path: path.join(SHOTS, "narrow-month-dots.png") });
});

test("mobile: week numbers in narrow layouts", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => { plugin.settings.showWeekNumbers = true; view.goTo(new Date(2026, 10, 14), "month"); });
	await page.waitForTimeout(200);
	eq(await page.$$eval(".ch-mc-row:not(.ch-mc-head) .ch-mc-wn", (d) => d.map((x) => x.textContent)), ["44", "45", "46", "47", "48", "49"], "month week numbers");
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
