/* Tasks: page, dialog, lists, completed tasks, sidebar. Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, shot, path, SHOTS }) => {



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
	// Our own time picker: type a start, pick the end from the list (shows durations).
	await page.click(".ch-task-start input");
	await page.keyboard.type("1030");
	await page.keyboard.press("Enter");
	await page.click(".ch-task-end input");
	const endItems = await page.$$eval(".ch-time-list [data-value]", (e) => e.slice(0, 3).map((x) => x.textContent));
	eq(endItems, ["10:45  ·  15 min", "11:00  ·  30 min", "11:15  ·  45 min"], "end list starts after the start, with durations");
	await page.click('.ch-time-list [data-value="11:45"]');
	eq(await page.$$eval(".ch-time-list", (e) => e.length), 0, "list closes after picking");
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

test("tasks: 'Upcoming' range follows the setting", {}, async ({ page }) => {
	await page.evaluate(async () => {
		const S = plugin.tasks;
		await S.upsert(S.draft({ title: "In 5 days", date: "2026-11-19" }));
		await S.upsert(S.draft({ title: "Christmas", date: "2026-12-24" }));
		await mountTasks();
		tasksView.select("upcoming");
	});
	const titles = () => page.$$eval(".ch-tasks-main .ch-task-title", (e) => e.map((x) => x.textContent));
	eq(await titles(), ["In 5 days"], "default 7 days");
	expect((await page.textContent(".ch-tasks-title")).includes("next 7 days"), "range shown in the title");
	await page.evaluate(() => { plugin.settings.tasksUpcomingDays = 60; plugin.tasks.trigger("changed"); });
	await page.waitForTimeout(100);
	eq(await titles(), ["In 5 days", "Christmas"], "60 days includes 24 Dec");
	eq(await page.$eval('[data-list="upcoming"] .ch-tasks-nav-count', (e) => e.textContent), "2", "count follows");
	const opts = await page.evaluate(() => { tab.constructor.tab = "tasks"; tab.display();
		const row = [...tab.containerEl.querySelectorAll(".setting-item")].find((x) => /Upcoming list/.test(x.textContent));
		return [...row.querySelector("select").options].map((o) => o.value); });
	eq(opts, ["7", "14", "30", "60", "90", "180", "365", "custom"], "setting options (+ Custom…)");
});

test("tasks: completed tasks – recent only, show older, clear, automatic clean-up", {}, async ({ page }) => {
	await page.evaluate(async () => {
		const S = plugin.tasks; const day = 86400000; const now = Date.now();
		const work = await S.addList("Work", "#2f9e44");
		window.workId = work.id;
		const add = (title, ago, listId) => S.upsert(S.draft({ title, done: true, completedAt: now - ago * day, listId: listId ?? "tasks" }));
		await add("Done today", 0); await add("Done 10 days ago", 10, work.id); await add("Done 50 days ago", 50, work.id); await add("Done 400 days ago", 400);
		await S.upsert(S.draft({ title: "Open work", listId: work.id }));
		await mountTasks(); tasksView.select("done");
	});
	const titles = () => page.$$eval(".ch-tasks-main .ch-task-title", (e) => e.map((x) => x.textContent));
	eq(await titles(), ["Done today", "Done 10 days ago"], "Done list: last 30 days");
	expect((await page.textContent(".ch-tasks-title")).includes("last 30 days"), "range in title");
	await page.click('.ch-tasks-link:text("Show 2 older")');
	eq(await titles(), ["Done today", "Done 10 days ago", "Done 50 days ago", "Done 400 days ago"], "show older");
	await page.screenshot({ path: path.join(SHOTS, "tasks-done.png") });
	// User list: collapsed Done section, recent only + show older + clear (this list only)
	await page.evaluate(() => tasksView.select(window.workId));
	await page.click(".ch-tasks-done-group summary");
	eq(await page.$$eval(".ch-tasks-done-group .ch-task-title", (e) => e.map((x) => x.textContent)), ["Done 10 days ago"], "list Done section: recent");
	expect(await page.isVisible('.ch-tasks-done-group .ch-tasks-link:text("Show 1 older")'), "show older in section");
	await page.click(".ch-tasks-done-group .ch-tasks-clear");
	await page.evaluate(() => [...document.querySelectorAll(".modal .mod-warning")].pop().click());
	await page.waitForTimeout(100);
	eq(await page.evaluate(() => plugin.tasks.items.map((t) => t.title).sort()), ["Done 400 days ago", "Done today", "Open work"], "clear completed only in this list");
	// Automatic clean-up
	const r = await page.evaluate(async () => {
		const off = await plugin.cleanUpDoneTasks();
		plugin.settings.tasksDeleteDoneAfterDays = 365;
		const on = await plugin.cleanUpDoneTasks();
		return { off, on, left: plugin.tasks.items.map((t) => t.title).sort() };
	});
	eq(r, { off: 0, on: 1, left: ["Done today", "Open work"] }, "clean-up: never by default, then older than 1 year deleted");
	// A done task without a completion time is kept (counts from now)
	const k = await page.evaluate(async () => {
		plugin._data = { settings: plugin.settings, events: [], tasks: { lists: [], items: [{ id: "x", title: "old done", done: true }] } };
		await plugin.loadPluginData(); plugin.settings.tasksDeleteDoneAfterDays = 30;
		return [await plugin.cleanUpDoneTasks(), plugin.tasks.items.length];
	});
	eq(k, [0, 1], "done task without completion time not deleted at once");
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
		await plugin.sidebar.toggleTasks();
		out.sidebar = plugin.sidebar.leaves("omni-calendar-tasks").map((l) => l.getRoot().name);
		out.setting = plugin.settings.tasksSidebar;
		plugin.settings.tasksEnabled = false; await plugin.sidebar.applyTasks(false);
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

test("desktop: tasks in the sidebar – button opens the Tasks page with the same list", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const side = await mountTasks({ side: true });
		side.select("tomorrow");
		const out = { mainHasBtn: null };
		const btn = side.contentEl.querySelector(".ch-tasks-open-full");
		out.sideHasBtn = !!btn;
		out.narrow = side.contentEl.querySelector(".ch-tasks").classList.contains("ch-narrow");
		btn.click(); await new Promise((r) => setTimeout(r, 50));
		const main = plugin.app.workspace.getLeavesOfType("omni-calendar-tasks").filter((l) => !plugin.sidebar.contains(l));
		out.mainOpened = main.length;
		out.mainList = main[0]?.getViewState().state.list ?? null;
		out.sideKept = plugin.sidebar.leaves("omni-calendar-tasks").length;
		return out;
	});
	eq(r, { mainHasBtn: null, sideHasBtn: true, narrow: true, mainOpened: 1, mainList: "tomorrow", sideKept: 1 }, "open full Tasks page from sidebar");
	await page.locator("#side").screenshot({ path: path.join(SHOTS, "tasks-sidebar.png") });
	await page.evaluate(() => mountTasks());
	eq(await page.$$eval("#main .ch-tasks-open-full", (e) => e.length), 0, "no such button on the full page");
});

test("mobile: tasks page – list bar, no sideways scrolling, dialog fits", { mobile: true }, async ({ page }) => {
	await seedTasks()(page);
	// Obsidian's mobile theme gives buttons padding and a minimum size – that made the checkboxes oval.
	await page.addStyleTag({ content: "button { padding: 6px 16px; min-width: 44px; min-height: 36px; }" });
	await page.evaluate(() => mountTasks());
	await page.waitForTimeout(200);
	const box = await page.$eval(".ch-task-checkbox", (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
	eq(box, [20, 20], "checkbox stays a circle");
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
	const d = await page.evaluate(() => {
		const date = document.querySelector(".ch-task-modal .ch-task-date-setting");
		const name = date.querySelector(".setting-item-name");
		const f = document.querySelector(".ch-task-modal .ch-task-date");
		return { labelFits: name.scrollWidth <= name.clientWidth + 1, empty: f.classList.contains("is-empty"), hintText: f.textContent };
	});
	eq(d, { labelFits: true, empty: true, hintText: "Select date" }, "date label not cut off, 'Select date' shown while empty");
	await page.tap('.ch-task-quick button >> text=Today');
	await page.waitForTimeout(80);
	const t2 = await page.evaluate(() => {
		const modal = document.querySelector(".ch-task-modal").getBoundingClientRect();
		const right = Math.max(...[...document.querySelectorAll(".ch-task-modal .ch-task-time-setting .setting-item-control > *")].map((e) => e.getBoundingClientRect().right));
		return { timeFits: right <= modal.right - 8, date: document.querySelector(".ch-task-date").textContent };
	});
	eq(t2, { timeFits: true, date: "Sat, Nov 14, 2026" }, "time row fits inside the dialog; chosen date shown");
	await page.screenshot({ path: path.join(SHOTS, "task-dialog-mobile-date.png") });
	await page.screenshot({ path: path.join(SHOTS, "task-dialog-mobile.png") });
});


test("desktop: Tasks in the sidebar – the list bar has arrows and scrolls with the mouse wheel", {}, async ({ page }) => {
	await page.evaluate(async () => {
		// A fixed sidebar width, like Obsidian's (the test page's sidebar would otherwise grow with its content).
		Object.assign(document.getElementById("side").style, { flex: "none", minWidth: "0", width: "280px" });
		for (const n of ["Work", "Home", "Project X"]) await plugin.tasks.addList(n, "#1c7ed6");
		await mountTasks({ side: true });
	});
	await page.waitForTimeout(200);
	const state = () => page.evaluate(() => {
		const bar = document.querySelector("#side .ch-tasks-bar");
		const vis = (sel) => { const b = document.querySelector(`#side ${sel}`); return !!b && !b.classList.contains("is-hidden"); };
		return { left: Math.round(bar.scrollLeft), prev: vis(".ch-tabs-prev"), next: vis(".ch-tabs-next"), more: bar.scrollWidth > bar.clientWidth };
	});
	let s = await state();
	eq([s.more, s.prev, s.next, s.left], [true, false, true, 0], "doesn't fit: only the right arrow at the start");
	await page.locator("#side").screenshot({ path: path.join(SHOTS, "tasks-sidebar-bar-arrows.png") });
	await page.locator("#side .ch-tabs-next").click();
	await page.waitForTimeout(500);
	s = await state();
	expect(s.left > 0 && s.prev, `arrow scrolled right: ${JSON.stringify(s)}`);
	// Mouse wheel over the bar scrolls it sideways.
	await page.locator("#side .ch-tabs-prev").click();
	await page.waitForTimeout(500);
	const box = await page.locator("#side .ch-tasks-bar").boundingBox();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.wheel(0, 200);
	await page.waitForTimeout(200);
	expect((await state()).left > 0, "wheel scrolls sideways");
	// At the end of the bar: only the left arrow.
	await page.evaluate(() => { const b = document.querySelector("#side .ch-tasks-bar"); b.scrollLeft = b.scrollWidth; });
	await page.waitForTimeout(200);
	s = await state();
	eq([s.prev, s.next], [true, false], "at the end: only the left arrow");
});

};
