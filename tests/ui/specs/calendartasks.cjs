/* Tasks in the calendar, tasks on events, linked notes on events, Tasks today (1.8). Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, shot, path, SHOTS }) => {

const dayView = async (page, d = 14) => {
	await page.evaluate((d) => view.goTo(new Date(2026, 10, d), "day"), d);
	await page.waitForTimeout(150);
};

test("desktop: event dialog – add tasks, tick off, '2/5' hint on the event, task shows its event", {}, async ({ page }) => {
	await dayView(page);
	await page.locator(".ch-tg-event", { hasText: "Design review" }).click();
	expect(await page.locator(".ch-event-tasks").isVisible(), "Tasks section in the event dialog");
	for (const t of ["Prepare slides", "Send summary"]) {
		await page.fill(".ch-event-task-add", t);
		await page.press(".ch-event-task-add", "Enter");
	}
	await page.waitForTimeout(100);
	eq(await page.locator(".ch-event-task-title").allTextContents(), ["Prepare slides", "Send summary"], "tasks listed in the dialog");
	eq(await page.textContent(".ch-event-tasks-progress"), "0/2", "progress in the dialog");
	await page.locator(".ch-event-task", { hasText: "Send summary" }).locator(".ch-task-checkbox").click();
	await page.waitForTimeout(100);
	eq(await page.textContent(".ch-event-tasks-progress"), "1/2", "ticked off in the dialog");
	const stored = await page.evaluate(() => plugin.tasks.items.map((t) => [t.title, t.date, t.event?.key.startsWith("local:"), t.event?.title]));
	eq(stored, [["Prepare slides", "2026-11-14", true, "Design review"], ["Send summary", "2026-11-14", true, "Design review"]], "stored with the event and its day");
	await shot(page, "event-dialog-tasks");
	await page.locator(".ch-modal-buttons button", { hasText: "Cancel" }).click();
	await page.waitForTimeout(150);
	eq(await page.locator(".ch-tg-event", { hasText: "Design review" }).locator(".ch-task-hint").textContent(), "1/2", "hint on the event block");
	// The same in the month view and the agenda.
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(150);
	eq(await page.locator(".ch-chip", { hasText: "Design review" }).locator(".ch-task-hint").textContent(), "1/2", "hint in the month view");
	// Event tasks appear in the task lists with their event; a click opens the event.
	await page.evaluate(() => mountTasks());
	await page.locator('.ch-tasks-nav-item[data-list="today"]').click();
	await page.waitForTimeout(150);
	eq(await page.locator(".ch-task", { hasText: "Prepare slides" }).locator(".ch-task-meta-event").textContent(), "Design review", "event shown in the list");
	await page.locator(".ch-task", { hasText: "Prepare slides" }).locator(".ch-task-meta-event").click();
	await page.waitForTimeout(100);
	eq(await page.inputValue(".ch-title-input"), "Design review", "opens the event dialog");
});

test("desktop: tasks and notes on a Google event are kept in Obsidian only", {}, async ({ page }) => {
	await page.evaluate(() => { window.updates = []; plugin.store.updateRemote = async (o, i) => window.updates.push(i); });
	await dayView(page, 15);
	await page.locator(".ch-tg-event", { hasText: "Dentist" }).click();
	await page.fill(".ch-event-task-add", "Bring insurance card");
	await page.press(".ch-event-task-add", "Enter");
	await page.locator(".ch-link-note-btn").click();
	await page.evaluate(async () => { const m = window.lastModal; await m.onChooseSuggestion(m.getSuggestions("Weekly")[0]); m.close(); });
	await page.waitForTimeout(100);
	eq(await page.locator(".ch-event-notes .ch-task-link-name").allTextContents(), ["Weekly"], "note listed in the dialog");
	const r = await page.evaluate(() => ({ links: plugin.data.eventLinks, task: plugin.tasks.items[0].event.key, updates: window.updates.length }));
	eq(r, { links: { "gcal:g1": ["Meetings/Weekly.md"] }, task: "gcal:g1", updates: 0 }, "stored locally, nothing sent to Google");
	await page.locator(".ch-modal-buttons button", { hasText: "Cancel" }).click();
	await page.waitForTimeout(100);
	// Right-click menu: open the linked note, create a note, link more, add a task.
	await page.locator(".ch-tg-event", { hasText: "Dentist" }).click({ button: "right" });
	const items = await page.evaluate(() => window.lastMenu.items.map((i) => i.t));
	for (const t of ["Open “Weekly”", "Create note", "Link note…", "Add task…"]) expect(items.includes(t), `menu has ${t}: ${items}`);
	// Linked notes follow renames and disappear on delete.
	await page.evaluate(() => { plugin.store.renameLink("Meetings/Weekly.md", "Meetings/Weekly 2.md"); });
	eq(await page.evaluate(() => plugin.data.eventLinks), { "gcal:g1": ["Meetings/Weekly 2.md"] }, "rename followed");
	await page.evaluate(() => { plugin.store.removeLink("Meetings/Weekly 2.md"); });
	eq(await page.evaluate(() => plugin.data.eventLinks), {}, "delete drops the link");
});

test("desktop: 'Create note' adds the note to the event's linked notes", {}, async ({ page }) => {
	await dayView(page);
	await page.locator(".ch-tg-event", { hasText: "Overlapping call" }).click();
	eq(await page.textContent(".ch-create-note-btn"), "Create note", "button label");
	await page.locator(".ch-create-note-btn").click();
	await page.waitForTimeout(150);
	const r = await page.evaluate(() => ({ links: plugin.data.events.find((e) => e.title === "Overlapping call").links, opened: window.openedFile }));
	eq(r, { links: ["Calendar/2026-11-14 Overlapping call.md"], opened: "Calendar/2026-11-14 Overlapping call.md" }, "linked and opened");
	// A single repeat of a series keeps its own notes.
	await page.locator(".ch-tg-event", { hasText: "Standup" }).click();
	await page.locator(".ch-create-note-btn").click();
	await page.waitForTimeout(150);
	const s = await page.evaluate(() => ({ map: Object.keys(plugin.data.eventLinks), series: plugin.data.events.find((e) => e.title === "Standup").links }));
	eq(s.series, undefined, "not on the whole series");
	expect(s.map.length === 1 && /^local:.+@2026-11-14$/.test(s.map[0]), `kept for this repeat: ${s.map}`);
});

test("mobile: event dialog with tasks and notes fits the phone", { mobile: true }, async ({ page }) => {
	await dayView(page);
	await page.evaluate(async () => {
		const occ = plugin.store.getOccurrencesForDay(new Date(2026, 10, 14)).find((o) => o.title === "Design review");
		const key = "local:" + occ.eventId;
		for (const t of ["Book room", "Print handouts", "Invite guests"]) await plugin.tasks.upsert(plugin.tasks.draft({ title: t, date: "2026-11-14", event: { key, title: occ.title, date: "2026-11-14" } }));
	});
	await page.locator(".ch-tg-event", { hasText: "Design review" }).tap();
	await page.waitForTimeout(150);
	const w = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(w <= 390, `no sideways scrolling: ${w}`);
	await page.locator(".ch-event-tasks").scrollIntoViewIfNeeded();
	await shot(page, "mobile-event-dialog-tasks");
});


/** Some tasks on Sat 14 Nov: two timed, two without a time (one done), one on an event without a time. */
const seedTasks = (page) => page.evaluate(async () => {
	const T = plugin.tasks;
	for (const t of [
		{ title: "Call bank", date: "2026-11-14", start: "13:00", end: "14:30" },
		{ title: "Pay rent", date: "2026-11-14", start: "15:00" },
		{ title: "Water plants", date: "2026-11-14" },
		{ title: "Buy milk", date: "2026-11-14", done: true, completedAt: Date.now() },
		{ title: "Slides (event)", date: "2026-11-14", event: { key: "local:x", title: "X", date: "2026-11-14" } },
		{ title: "Old report", date: "2026-11-12" },
	]) await T.upsert(T.draft(t));
});

test("desktop: tasks in the week view – light blocks, one counter per day, tick off, hide done", {}, async ({ page }) => {
	await seedTasks(page);
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.waitForTimeout(200);
	eq(await page.locator(".ch-tg-task .ch-tg-task-title").allTextContents(), ["Call bank", "Pay rent"], "timed tasks as blocks");
	eq(await page.locator(".ch-tg-task", { hasText: "Call bank" }).locator(".ch-tg-task-time").textContent(), "13:00–14:30", "time range");
	const counter = page.locator('.ch-tg-allday-cell .ch-day-tasks[data-date="2026-11-14"]');
	eq(await counter.textContent(), "1", "counter: open tasks without a time (not the done one, not the event's)");
	eq(await page.locator('.ch-tg-allday-cell .ch-day-tasks[data-date="2026-11-12"]').textContent(), "1", "past day too");
	await page.screenshot({ path: path.join(SHOTS, "week-tasks.png"), clip: { x: 0, y: 0, width: 1120, height: 900 } });
	// Tick off in the calendar.
	await page.locator(".ch-tg-task", { hasText: "Pay rent" }).locator(".ch-task-checkbox").click();
	await page.waitForTimeout(150);
	expect(await page.locator(".ch-tg-task.is-done", { hasText: "Pay rent" }).count() === 1, "done task struck through");
	// Counter → day list: add a task, tick one off.
	await counter.click();
	await page.waitForTimeout(100);
	eq(await page.locator(".ch-day-tasks-modal .ch-task-title").allTextContents(), ["Call bank", "Water plants", "Pay rent", "Buy milk"], "day list: open first (timed before untimed), then done");
	await page.fill(".ch-day-tasks-add", "Post letter");
	await page.press(".ch-day-tasks-add", "Enter");
	await page.waitForTimeout(100);
	eq(await page.evaluate(() => plugin.tasks.items.find((t) => t.title === "Post letter").date), "2026-11-14", "added for that day");
	await shot(page, "day-tasks-modal");
	await page.evaluate(() => window.lastModal.close());
	await page.waitForTimeout(150);
	eq(await page.locator('.ch-tg-allday-cell .ch-day-tasks[data-date="2026-11-14"]').textContent(), "2", "counter updated");
	// Setting: hide completed tasks.
	await page.evaluate(() => { plugin.settings.tasksCalendarShowDone = false; plugin.tasks.trigger("changed"); });
	await page.waitForTimeout(150);
	eq(await page.locator(".ch-tg-task .ch-tg-task-title").allTextContents(), ["Call bank"], "done task hidden");
	// Setting: no tasks in the calendar.
	await page.evaluate(() => { plugin.settings.tasksInCalendar = false; plugin.tasks.trigger("changed"); });
	await page.waitForTimeout(150);
	eq(await page.locator(".ch-tg-task, .ch-day-tasks").count(), 0, "tasks off in the calendar");
});

test("desktop: dragging a task in the week view – new time and day, all-day row drops the time", {}, async ({ page }) => {
	await seedTasks(page);
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.waitForTimeout(250);
	const H = 48;
	const box = await page.locator(".ch-tg-task", { hasText: "Call bank" }).boundingBox();
	const colW = (await page.locator(".ch-tg-col").first().boundingBox()).width;
	const x0 = box.x + box.width / 2, y0 = box.y + 10;
	await page.mouse.move(x0, y0);
	await page.mouse.down();
	await page.mouse.move(x0 - colW, y0 + 2 * H, { steps: 12 });
	await page.waitForTimeout(100);
	const preview = await page.evaluate(() => document.querySelector(".ch-drop-preview .ch-tg-selection-time")?.textContent);
	await page.mouse.up();
	await page.waitForTimeout(150);
	const t = await page.evaluate(() => { const t = plugin.tasks.items.find((x) => x.title === "Call bank"); return [t.date, t.start, t.end]; });
	eq(preview, "15:00 – 16:30", "preview");
	eq(t, ["2026-11-13", "15:00", "16:30"], "moved one day back, two hours later, same length");
	// Onto the all-day row of Monday: date only.
	await page.locator(".ch-tg-task", { hasText: "Call bank" }).dragTo(page.locator(".ch-tg-allday-cell").nth(0));
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => { const t = plugin.tasks.items.find((x) => x.title === "Call bank"); return [t.date, t.start ?? null, t.end ?? null]; }), ["2026-11-09", null, null], "all-day row: no time");
});

test("desktop: month view badge, agenda counter, mini calendar 'Tasks today'", {}, async ({ page }) => {
	await seedTasks(page);
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(200);
	eq(await page.locator('.ch-month .ch-day-tasks[data-date="2026-11-14"]').textContent(), "3", "month badge: all open tasks of the day");
	await page.locator('.ch-month .ch-day-tasks[data-date="2026-11-14"]').click();
	await page.waitForTimeout(100);
	expect(await page.locator(".ch-day-tasks-modal").isVisible(), "badge opens the day's tasks");
	await page.evaluate(() => window.lastModal.close());
	await page.evaluate(() => view.goTo(new Date(2026, 10, 12), "agenda"));
	await page.waitForTimeout(150);
	eq(await page.locator(".ch-agenda-date .ch-day-tasks").count(), 2, "agenda: counters on the 12th and the 14th");
	// Mini calendar: open tasks due today or overdue, plus done today.
	await page.waitForTimeout(100);
	const mini = await page.evaluate(() => [...document.querySelectorAll(".ch-mini-task")].map((r) => [r.querySelector(".ch-mini-task-title").textContent, r.classList.contains("is-done"), r.querySelector(".ch-mini-task-when")?.textContent ?? ""]));
	expect(mini.some(([t, , w]) => t === "Old report" && w === "overdue"), `overdue marked: ${JSON.stringify(mini)}`);
	expect(mini.some(([t, d]) => t === "Buy milk" && d), "done today, struck through");
	eq(mini.length, 6, "five open + one done today");
	await page.locator(".ch-mini-task", { hasText: "Water plants" }).locator(".ch-task-checkbox").click();
	await page.waitForTimeout(150);
	expect(await page.locator(".ch-mini-task.is-done", { hasText: "Water plants" }).count() === 1, "ticked off in the mini calendar");
	await page.locator("#side").screenshot({ path: path.join(SHOTS, "mini-tasks-today.png") });
	await page.evaluate(() => { plugin.settings.tasksInMiniCalendar = false; plugin.tasks.trigger("changed"); });
	await page.waitForTimeout(150);
	eq(await page.locator(".ch-mini-tasks").count(), 0, "setting hides it");
});

test("mobile: tasks in the compact month and in the day view", { mobile: true }, async ({ page }) => {
	await seedTasks(page);
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(200);
	expect(await page.locator(".ch-mc-taskmark").count() >= 2, "task marks in the compact grid");
	eq(await page.locator('.ch-mc-day-head .ch-day-tasks').textContent(), "3", "counter for the selected day");
	await shot(page, "mobile-month-tasks");
	await page.locator('.ch-mc-day-head .ch-day-tasks').tap();
	await page.waitForTimeout(150);
	const w = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(w <= 390, `day tasks fit the phone: ${w}`);
	await shot(page, "mobile-day-tasks-modal");
	await page.evaluate(() => window.lastModal.close());
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "day"));
	await page.waitForTimeout(200);
	eq(await page.locator(".ch-tg-task").count(), 2, "task blocks in the day view");
	await page.locator(".ch-tg-task", { hasText: "Call bank" }).tap();
	await page.waitForTimeout(150);
	eq(await page.inputValue(".ch-title-input"), "Call bank", "tap opens the task, not a new event");
	eq(await page.evaluate(() => __eventMod.EventModal.openCount), 0, "no event dialog");
});

};
