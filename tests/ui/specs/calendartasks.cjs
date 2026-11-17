/* Tasks in the calendar, tasks on events, linked notes on events, Tasks today (1.8). Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, shot, path, SHOTS }) => {

const dayView = async (page, d = 14) => {
	await page.evaluate((d) => view.goTo(new Date(2026, 10, d), "day"), d);
	await page.waitForTimeout(150);
};

test("desktop: event dialog – add tasks, tick off, '2/5' hint on the event, task shows its event", {}, async ({ page }) => {
	await dayView(page);
	await page.locator(".ch-tg-event", { hasText: "Design review" }).click();
	await page.waitForTimeout(100); // the dialog puts the cursor in the title first
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
	await page.waitForTimeout(100); // the dialog puts the cursor in the title first
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
	// Wait until the grid has finished scrolling to its start hour (the block stops moving).
	const block = page.locator(".ch-tg-task", { hasText: "Call bank" });
	let box = await block.boundingBox();
	for (let i = 0; i < 20; i++) {
		await page.waitForTimeout(50);
		const next = await block.boundingBox();
		if (next.y === box.y) break;
		box = next;
	}
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


/** A task with two subtasks on "Design review" (Sat 14 Nov). */
const seedEventTaskWithSubtasks = (page) => page.evaluate(async () => {
	const occ = plugin.store.getOccurrencesForDay(new Date(2026, 10, 14)).find((o) => o.title === "Design review");
	await plugin.tasks.upsert(plugin.tasks.draft({
		title: "Prepare slides", date: "2026-11-14", event: { key: "local:" + occ.eventId, title: occ.title, date: "2026-11-14" },
		subtasks: [{ id: "s1", title: "Collect numbers", done: false }, { id: "s2", title: "Draft outline", done: true }],
	}));
});

for (const mobile of [false, true]) {
	test(`${mobile ? "mobile" : "desktop"}: subtasks of an event's task are shown and tickable in the event dialog`, { mobile }, async ({ page }) => {
		await seedEventTaskWithSubtasks(page);
		await dayView(page);
		const ev = page.locator(".ch-tg-event", { hasText: "Design review" });
		if (mobile) await ev.tap(); else await ev.click();
		await page.waitForTimeout(150);
		eq(await page.locator(".ch-event-task-subcount").textContent(), "1/2", "subtask progress next to the task");
		eq(await page.locator(".ch-event-subtask-title").allTextContents(), ["Collect numbers", "Draft outline"], "subtasks listed");
		const box = page.locator(".ch-event-subtask", { hasText: "Collect numbers" }).locator(".ch-task-checkbox");
		if (mobile) await box.tap(); else await box.click();
		await page.waitForTimeout(150);
		eq(await page.evaluate(() => plugin.tasks.items[0].subtasks.map((x) => x.done)), [true, true], "ticked off from the event dialog");
		eq(await page.locator(".ch-event-task-subcount").textContent(), "2/2", "progress updated");
		eq(await page.evaluate(() => window.lastModal.constructor.name.includes("Task")), false, "ticking didn't open the task dialog");
		await page.locator(".ch-event-tasks").scrollIntoViewIfNeeded();
		await shot(page, `${mobile ? "mobile-" : ""}event-dialog-subtasks`);
		const count = page.locator(".ch-event-task-subcount");
		if (mobile) await count.tap(); else await count.click();
		await page.waitForTimeout(100);
		eq(await page.locator(".ch-event-subtask").count(), 0, "folded away with a click on the count");
		if (mobile) {
			const w = await page.evaluate(() => document.documentElement.scrollWidth);
			expect(w <= 390, `no sideways scrolling: ${w}`);
		}
	});
}


/** Adds a task to the first occurrence titled `title` on Nov `day`; returns nothing. */
const addEventTask = (page, title, task, day = 14) => page.evaluate(async ([title, task, day]) => {
	const occ = plugin.store.getOccurrencesForDay(new Date(2026, 10, day)).find((o) => o.title === title);
	const date = `2026-11-${day}`;
	const key = occ.eventId ? (occ.recurring ? `local:${occ.eventId}@${date}` : `local:${occ.eventId}`) : occ.key;
	await plugin.tasks.upsert(plugin.tasks.draft({ title: task, date, event: { key, title: occ.title, date } }));
}, [title, task, day]);
const taskTitles = (page) => page.evaluate(() => plugin.tasks.items.map((t) => t.title));

test("desktop: deleting an event deletes its tasks (after asking), other tasks stay", {}, async ({ page }) => {
	await addEventTask(page, "Design review", "Slides");
	await addEventTask(page, "Design review", "Summary");
	await addEventTask(page, "Overlapping call", "Agenda");
	await page.evaluate(async () => plugin.tasks.upsert(plugin.tasks.draft({ title: "Standalone", date: "2026-11-14" })));
	await dayView(page);
	// From the dialog: asks, Cancel keeps everything.
	await page.locator(".ch-tg-event", { hasText: "Design review" }).click();
	await page.locator(".ch-modal-buttons button", { hasText: /^Delete$/ }).click();
	await page.waitForTimeout(100);
	expect((await page.locator(".modal p").last().textContent()).includes("Its 2 tasks will be deleted too."), "asks and says how many tasks");
	await page.locator(".modal button", { hasText: "Cancel" }).last().click();
	await page.waitForTimeout(100);
	eq(await taskTitles(page), ["Slides", "Summary", "Agenda", "Standalone"], "cancel keeps the tasks");
	await page.locator(".ch-modal-buttons button", { hasText: /^Delete$/ }).first().click();
	await page.locator(".modal .mod-warning", { hasText: "Delete" }).last().click();
	await page.waitForTimeout(150);
	eq(await taskTitles(page), ["Agenda", "Standalone"], "event and its tasks deleted");
	eq(await page.evaluate(() => plugin.data.events.some((e) => e.title === "Design review")), false, "event deleted");
	// From the right-click menu.
	await page.locator(".ch-tg-event", { hasText: "Overlapping call" }).click({ button: "right" });
	await page.evaluate(() => window.lastMenu.items.find((i) => i.t === "Delete").fn());
	await page.locator(".modal .mod-warning", { hasText: "Delete" }).last().click();
	await page.waitForTimeout(150);
	eq(await taskTitles(page), ["Standalone"], "menu delete takes the tasks too");
});

test("desktop: deleting one repeat deletes only that repeat's tasks; Google series too", {}, async ({ page }) => {
	await addEventTask(page, "Standup", "Today's standup task", 14);
	await addEventTask(page, "Standup", "Tomorrow's standup task", 15);
	await addEventTask(page, "Team lunch (Google series)", "Book table", 14);
	await page.evaluate(() => { window.dels = []; plugin.store.deleteRemote = async (o, series) => window.dels.push(series); });
	await dayView(page);
	await page.locator(".ch-tg-event", { hasText: "Standup" }).click({ button: "right" });
	await page.evaluate(() => window.lastMenu.items.find((i) => i.t === "Delete this occurrence").fn());
	await page.locator(".modal .mod-warning", { hasText: "Delete" }).last().click();
	await page.waitForTimeout(150);
	eq(await taskTitles(page), ["Tomorrow's standup task", "Book table"], "only the 14th's task deleted");
	await page.locator(".ch-tg-event", { hasText: "Team lunch" }).click({ button: "right" });
	await page.evaluate(() => window.lastMenu.items.find((i) => i.t === "Delete series").fn());
	expect((await page.locator(".modal p").last().textContent()).includes("Its task will be deleted too."), "Google delete mentions the task");
	await page.locator(".modal .mod-warning", { hasText: "Delete" }).last().click();
	await page.waitForTimeout(150);
	eq([await page.evaluate(() => window.dels), await taskTitles(page)], [[true], ["Tomorrow's standup task"]], "series deleted with its task");
});

test("desktop: moving an event to another calendar keeps its tasks and notes", {}, async ({ page }) => {
	await addEventTask(page, "Dentist (Google)", "Insurance card", 15);
	await page.evaluate(async () => {
		const occ = plugin.store.getOccurrencesForDay(new Date(2026, 10, 15)).find((o) => o.title.startsWith("Dentist"));
		await plugin.store.setLinks(occ, ["Inbox.md"]);
		// Deleting at Google removes it from what is loaded, like the real refresh after a delete.
		plugin.store.deleteRemote = async (o) => plugin.store.remote.set("gcal", plugin.store.remote.get("gcal").filter((e) => e.id !== o.remote.id));
	});
	await dayView(page, 15);
	await page.locator(".ch-tg-event", { hasText: "Dentist" }).click();
	await page.selectOption(".modal select", "personal");
	await page.click(".ch-modal-buttons button.mod-cta");
	await page.waitForTimeout(200);
	const r = await page.evaluate(() => {
		const ev = plugin.data.events.find((e) => e.title === "Dentist (Google)");
		return { key: plugin.tasks.items[0].event.key === `local:${ev.id}`, links: ev.links, map: plugin.data.eventLinks };
	});
	eq(r, { key: true, links: ["Inbox.md"], map: {} }, "Google → local: task and note moved to the new event");
	// Local → Google: the new event's id comes back from Google.
	await page.evaluate(() => { plugin.store.createRemote = async (src) => `${src.id}:new1`; });
	await page.locator(".ch-tg-event", { hasText: "Dentist" }).click();
	await page.selectOption(".modal select", "gcal");
	await page.click(".ch-modal-buttons button.mod-cta");
	await page.waitForTimeout(200);
	eq(await page.evaluate(() => [plugin.tasks.items[0].event.key, plugin.data.eventLinks]), ["gcal:new1", { "gcal:new1": ["Inbox.md"] }], "local → Google");
});

test("desktop: a task whose event is gone is marked; clicking offers keep or delete", {}, async ({ page }) => {
	await page.evaluate(async () => {
		for (const title of ["Orphan A", "Orphan B"]) await plugin.tasks.upsert(plugin.tasks.draft({ title, date: "2026-11-14", event: { key: "local:gone", title: "Old meeting", date: "2026-11-14" } }));
		await mountTasks();
	});
	await page.locator('.ch-tasks-nav-item[data-list="today"]').click();
	await page.waitForTimeout(100);
	eq(await page.locator(".ch-task-meta-event.is-gone").count(), 2, "marked as deleted");
	await page.locator(".ch-task", { hasText: "Orphan A" }).locator(".ch-task-meta-event").click();
	await page.waitForTimeout(100);
	await page.locator(".modal button", { hasText: "Keep task without event" }).click();
	await page.waitForTimeout(100);
	await page.locator(".ch-task", { hasText: "Orphan B" }).locator(".ch-task-meta-event").click();
	await page.waitForTimeout(100);
	await page.locator(".modal button", { hasText: "Delete task" }).click();
	await page.waitForTimeout(100);
	eq(await page.evaluate(() => plugin.tasks.items.map((t) => [t.title, !!t.event])), [["Orphan A", false]], "kept without event / deleted");
});


/** Open the new-event dialog for Fri 20 Nov, type a title and two tasks, link one note. */
const newEventWithExtras = async (page, title, mobile = false) => {
	await page.evaluate(() => new __eventMod.EventModal(plugin, { start: new Date(2026, 10, 20, 9) }).open());
	await page.waitForTimeout(100); // the dialog puts the cursor in the title first
	await page.fill(".ch-title-input", title);
	for (const t of ["Book room", "Send invite"]) {
		await page.fill(".ch-event-task-add", t);
		await page.press(".ch-event-task-add", "Enter");
	}
	const link = page.locator(".ch-link-note-btn");
	if (mobile) await link.tap(); else await link.click();
	await page.evaluate(async () => { const m = window.lastModal; await m.onChooseSuggestion(m.getSuggestions("Inbox")[0]); m.close(); });
	await page.waitForTimeout(100);
};
const saveDialog = async (page) => {
	await page.click(".ch-modal-buttons button.mod-cta");
	await page.waitForTimeout(200);
};
const attached = (page, title) => page.evaluate((title) => {
	const ev = plugin.data.events.find((e) => e.title === title);
	return { tasks: plugin.tasks.items.map((t) => [t.title, t.date, t.event?.key ?? null]), links: ev?.links ?? null, map: plugin.data.eventLinks, evId: ev?.id ?? null };
}, title);

test("desktop: tasks and notes typed into a new event are attached when it is saved", {}, async ({ page }) => {
	await newEventWithExtras(page, "Workshop");
	eq(await page.locator(".ch-draft-task .ch-event-task-title").allTextContents(), ["Book room", "Send invite"], "listed before saving");
	eq(await page.evaluate(() => plugin.tasks.items.length), 0, "nothing stored before saving");
	await shot(page, "new-event-draft-tasks");
	await page.locator(".ch-draft-task", { hasText: "Send invite" }).locator("button").click();
	await page.fill(".ch-event-task-add", "Send agenda");
	await page.press(".ch-event-task-add", "Enter");
	await saveDialog(page);
	const r = await attached(page, "Workshop");
	const key = `local:${r.evId}`;
	eq(r.tasks, [["Book room", "2026-11-20", key], ["Send agenda", "2026-11-20", key]], "tasks on the event, with its day");
	eq(r.links, ["Inbox.md"], "linked note on the event");
	// Cancel forgets everything.
	await newEventWithExtras(page, "Never saved");
	await page.locator(".ch-modal-buttons button", { hasText: "Cancel" }).click();
	await page.waitForTimeout(100);
	eq(await page.evaluate(() => plugin.tasks.items.length), 2, "cancel: no tasks added");
});

test("desktop: new event in Google + Obsidian – tasks go with the first calendar's copy only; repeating event → first repeat", {}, async ({ page }) => {
	await page.evaluate(() => { plugin.store.createRemote = async (src) => `${src.id}:new7`; });
	await newEventWithExtras(page, "Offsite");
	await page.locator(".ch-target-chip", { hasText: "Mine (Google)" }).click();
	await page.locator(".ch-target-chip", { hasText: "Personal" }).click(); // now only Google…
	await page.locator(".ch-target-chip", { hasText: "Personal" }).click(); // …then Google first, Personal second
	eq(await page.textContent(".ch-extras-hint"), "Tasks and linked notes go with the copy in Mine (Google).", "says which copy");
	await saveDialog(page);
	const r = await attached(page, "Offsite");
	eq([r.tasks.map((t) => t[2]), r.links, r.map], [["gcal:new7", "gcal:new7"], null, { "gcal:new7": ["Inbox.md"] }], "attached once, to the Google copy");
	// A repeating local event: they go with its first repeat.
	await newEventWithExtras(page, "Weekly sync");
	await page.selectOption(".ch-repeat-row select", "weekly");
	await saveDialog(page);
	const w = await attached(page, "Weekly sync");
	eq(w.tasks.slice(2).map((t) => t[2]), [`local:${w.evId}@2026-11-20`, `local:${w.evId}@2026-11-20`], "first repeat");
	eq(w.map[`local:${w.evId}@2026-11-20`], ["Inbox.md"], "note on the first repeat");
	await page.evaluate(() => view.goTo(new Date(2026, 10, 20), "day"));
	await page.waitForTimeout(150);
	eq(await page.locator(".ch-tg-event", { hasText: "Weekly sync" }).locator(".ch-task-hint").textContent(), "0/2", "the repeat shows its tasks");
});

test("mobile: tasks in the new-event dialog", { mobile: true }, async ({ page }) => {
	await newEventWithExtras(page, "Phone event", true);
	const w = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(w <= 390, `no sideways scrolling: ${w}`);
	await page.locator(".ch-event-tasks").scrollIntoViewIfNeeded();
	await shot(page, "mobile-new-event-draft-tasks");
	await page.locator(".ch-modal-buttons button.mod-cta").tap();
	await page.waitForTimeout(200);
	eq((await attached(page, "Phone event")).tasks.length, 2, "saved with the event");
});


test("desktop: tasks move with their event – dialog, drag, Google; 'Tasks today' follows", {}, async ({ page }) => {
	// "Design review" is today (14 Nov): one task on its day, one with a time two days before.
	await addEventTask(page, "Design review", "Slides");
	await page.evaluate(async () => {
		const t = plugin.tasks.items[0];
		await plugin.tasks.upsert(plugin.tasks.draft({ title: "Book room", date: "2026-11-12", start: "09:00", event: { ...t.event } }));
	});
	await page.waitForTimeout(150);
	expect((await page.locator(".ch-mini-task-title").allTextContents()).includes("Slides"), "today's event task in 'Tasks today'");
	const dates = () => page.evaluate(() => plugin.tasks.items.map((t) => [t.title, t.date, t.start ?? null, t.event.date]));
	// Saved in the dialog with a new date (the dialog stores it like this).
	await page.evaluate(async () => {
		const ev = plugin.data.events.find((e) => e.title === "Design review");
		await plugin.store.updateEvent(ev.id, { start: "2026-11-17T10:00", end: "2026-11-17T11:30" });
	});
	await page.waitForTimeout(150);
	eq(await dates(page), [["Slides", "2026-11-17", null, "2026-11-17"], ["Book room", "2026-11-15", "09:00", "2026-11-17"]], "moved by 3 days, time kept");
	expect(!(await page.locator(".ch-mini-task-title").allTextContents()).includes("Slides"), "gone from 'Tasks today'");
	// Dragged in the month view to the 19th.
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "month"));
	await page.waitForTimeout(150);
	const cells = page.locator(".ch-month-cell");
	const idx = await cells.evaluateAll((els) => els.findIndex((c) => c.querySelector(".ch-day-num")?.textContent === "19" && !c.classList.contains("ch-other-month")));
	await page.locator(".ch-month .ch-chip", { hasText: "Design review" }).dragTo(cells.nth(idx));
	await page.waitForTimeout(200);
	eq((await dates(page)).map((d) => d[1]), ["2026-11-19", "2026-11-17"], "dragged: tasks follow");
	// A Google event moved in Google Calendar itself: after the refresh its task follows.
	await addEventTask(page, "Dentist (Google)", "Insurance card", 15);
	await page.evaluate(() => {
		const g = plugin.store.remote.get("gcal").find((e) => e.id === "g1");
		g.start = new Date(2026, 10, 18, 14); g.end = new Date(2026, 10, 18, 15); g.title = "Dentist (moved)";
		plugin.store.notify();
	});
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => { const t = plugin.tasks.items.find((x) => x.title === "Insurance card"); return [t.date, t.event.title]; }), ["2026-11-18", "Dentist (moved)"], "Google change followed");
});


const tracked = (page) => page.evaluate(() => plugin.tasks.items.filter((t) => t.event?.self).map((t) => [t.title, t.date, t.start ?? null, t.end ?? null, t.done]));

test("desktop: 'Track as task' – switch in the dialog, task in the lists, tick circle on the event, follows and goes with it", {}, async ({ page }) => {
	await dayView(page);
	await page.locator(".ch-tg-event", { hasText: "Design review" }).click();
	await page.waitForTimeout(100);
	await page.locator(".ch-track-setting .checkbox-container").click();
	await page.waitForTimeout(100);
	eq(await tracked(page), [["Design review", "2026-11-14", "10:00", "11:30", false]], "task with the event's title, day and time");
	eq(await page.locator(".ch-event-tasks-progress").textContent(), "", "not counted as one of the event's tasks");
	await page.locator(".ch-modal-buttons button", { hasText: "Cancel" }).click();
	await page.waitForTimeout(150);
	// Calendar: no extra task block, a tick circle on the event instead.
	eq(await page.locator(".ch-tg-task").count(), 0, "not drawn twice");
	await page.locator(".ch-tg-event", { hasText: "Design review" }).locator(".ch-track-check").click();
	await page.waitForTimeout(150);
	eq((await tracked(page))[0][4], true, "ticked off in the calendar");
	expect(await page.locator(".ch-tg-event.ch-event-done", { hasText: "Design review" }).count() === 1, "event struck through");
	eq(await page.locator(".modal").count(), 0, "ticking didn't open the dialog");
	await shot(page, "track-as-task-calendar");
	// The event changes: the task follows (title, day, time).
	await page.evaluate(async () => {
		const ev = plugin.data.events.find((e) => e.title === "Design review");
		await plugin.store.updateEvent(ev.id, { title: "Design review v2", start: "2026-11-16T14:00", end: "2026-11-16T15:00" });
	});
	await page.waitForTimeout(150);
	eq(await tracked(page), [["Design review v2", "2026-11-16", "14:00", "15:00", true]], "follows the event");
	// Task lists: marked "Event"; a click opens the event.
	await page.evaluate(async () => { await plugin.tasks.setDone(plugin.tasks.items[0].id, false); await mountTasks(); });
	await page.locator('.ch-tasks-nav-item[data-list="upcoming"]').click();
	await page.waitForTimeout(100);
	eq(await page.locator(".ch-task", { hasText: "Design review v2" }).locator(".ch-task-meta-event").textContent(), "Event", "marked as event");
	await page.locator(".ch-task", { hasText: "Design review v2" }).locator(".ch-task-title").click();
	await page.waitForTimeout(150);
	eq(await page.inputValue(".ch-title-input"), "Design review v2", "opens the event dialog");
	// Deleting the event takes the tracking entry with it, without asking (it has no other tasks).
	await page.locator(".ch-modal-buttons button", { hasText: /^Delete$/ }).click();
	await page.waitForTimeout(150);
	eq([await tracked(page), await page.locator(".modal").count()], [[], 0], "gone with the event");
});

test("desktop: 'Track as task' – new events, Google events via the menu, not for repeats", {}, async ({ page }) => {
	await page.evaluate(() => new __eventMod.EventModal(plugin, { start: new Date(2026, 10, 20, 9) }).open());
	await page.waitForTimeout(100);
	await page.fill(".ch-title-input", "Workshop");
	await page.locator(".ch-track-setting .checkbox-container").click();
	await page.click(".ch-modal-buttons button.mod-cta");
	await page.waitForTimeout(200);
	eq(await tracked(page), [["Workshop", "2026-11-20", "09:00", "10:00", false]], "new event tracked on save");
	// Repeating new event: not tracked (comes with 1.9), says so.
	await page.evaluate(() => new __eventMod.EventModal(plugin, { start: new Date(2026, 10, 21, 9) }).open());
	await page.waitForTimeout(100);
	await page.fill(".ch-title-input", "Weekly");
	await page.selectOption(".ch-repeat-row select", "weekly");
	await page.locator(".ch-track-setting .checkbox-container").click();
	await page.click(".ch-modal-buttons button.mod-cta");
	await page.waitForTimeout(200);
	eq((await tracked(page)).length, 1, "repeating event not tracked");
	expect(await page.evaluate(() => window.notices.some((n) => /repeating events/.test(n))), "says why");
	// Google event via the right-click menu; repeats have no entry.
	await dayView(page, 15);
	await page.locator(".ch-tg-event", { hasText: "Dentist" }).click({ button: "right" });
	await page.evaluate(() => window.lastMenu.items.find((i) => i.t === "Track as task").fn());
	await page.waitForTimeout(150);
	eq((await tracked(page))[1], ["Dentist (Google)", "2026-11-15", "14:00", "15:00", false], "Google event tracked (kept in Obsidian)");
	await page.locator(".ch-tg-event", { hasText: "Dentist" }).click({ button: "right" });
	const items = await page.evaluate(() => window.lastMenu.items.map((i) => i.t));
	expect(items.includes("Mark event as done") && items.includes("Stop tracking as task"), `menu: ${items}`);
	await page.locator(".ch-tg-event", { hasText: "Standup" }).first().click({ button: "right" });
	expect(!(await page.evaluate(() => window.lastMenu.items.map((i) => i.t))).includes("Track as task"), "no entry for a repeat");
});

test("mobile: 'Track as task' – switch and tick circle by tapping", { mobile: true }, async ({ page }) => {
	await dayView(page);
	await page.locator(".ch-tg-event", { hasText: "Design review" }).tap();
	await page.waitForTimeout(150);
	await page.locator(".ch-track-setting .checkbox-container").tap();
	await page.locator(".ch-track-setting").scrollIntoViewIfNeeded();
	await shot(page, "mobile-track-as-task-dialog");
	await page.locator(".ch-modal-buttons button", { hasText: "Cancel" }).tap();
	await page.waitForTimeout(150);
	await page.locator(".ch-tg-event", { hasText: "Design review" }).locator(".ch-track-check").tap();
	await page.waitForTimeout(150);
	eq([(await tracked(page))[0][4], await page.locator(".modal").count()], [true, 0], "ticked off by tapping, no dialog");
});

};
