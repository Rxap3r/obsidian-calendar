/* Sidebar: mini calendar, day planner, sidebar settings, ribbon. Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, shot, path, SHOTS }) => {

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

};
