/* Details view of events and tasks (1.9). Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, settle, shot, path, SHOTS }) => {

/** Back to the default: clicking opens the details view (the test setup starts with the edit dialog). */
const detailsMode = (page) => page.evaluate(() => { plugin.settings.clickOpens = "details"; });
const dayView = async (page, d = 14) => {
	await page.evaluate((d) => view.goTo(new Date(2026, 10, d), "day"), d);
	await page.waitForTimeout(150);
};
const modal = (page) => page.locator(".modal.ch-details-modal");

test("desktop: clicking an event opens its details; Edit notes changes only the description; Edit opens the dialog", {}, async ({ page }) => {
	await detailsMode(page);
	await dayView(page);
	await page.locator(".ch-tg-event", { hasText: "Design review" }).click();
	await settle(page);
	const text = await modal(page).textContent();
	for (const t of ["Work", "Room 4", "No description", "Tasks", "Linked notes", "Track as task"]) expect(text.includes(t), `details show "${t}"`);
	eq(await page.locator(".ch-title-input").count(), 0, "no edit dialog");
	await shot(page, "details-event");
	// Clicking the text does nothing; only "Edit notes" opens the field.
	await page.locator(".ch-details-notes-empty").click();
	eq(await page.locator(".ch-details-notes-field").count(), 0, "clicking the text doesn't edit");
	await page.locator(".ch-details-edit-notes").click();
	await page.fill(".ch-details-notes-field", "Bring the prototype");
	// A change elsewhere while typing doesn't throw away the text.
	await page.evaluate(() => plugin.store.notify());
	await settle(page);
	eq(await page.inputValue(".ch-details-notes-field"), "Bring the prototype", "text kept while editing");
	await page.locator(".ch-details-notes-buttons .mod-cta").click();
	await settle(page);
	eq(await page.evaluate(() => plugin.data.events.find((e) => e.title === "Design review").description), "Bring the prototype", "description saved");
	eq(await page.locator(".ch-details-description").textContent(), "Bring the prototype", "shown in the view");
	// Cancel keeps it.
	await page.locator(".ch-details-edit-notes").click();
	await page.fill(".ch-details-notes-field", "Something else");
	await page.locator(".ch-details-notes-buttons button", { hasText: "Cancel" }).click();
	eq(await page.evaluate(() => plugin.data.events.find((e) => e.title === "Design review").description), "Bring the prototype", "cancel changes nothing");
	// Edit → the edit dialog.
	await page.locator(".ch-modal-buttons button", { hasText: "Edit" }).click();
	await settle(page);
	eq([await page.locator(".modal.ch-details-modal").count(), await page.inputValue(".ch-title-input")], [0, "Design review"], "edit dialog instead of the details");
});

test("desktop: details of Google and read-only events; right-click offers both; setting 'Edit dialog directly'", {}, async ({ page }) => {
	await detailsMode(page);
	await page.evaluate(() => { window.updates = []; plugin.store.updateRemote = async (o, i) => window.updates.push([o.remote.id, i.description, i.title]); });
	await dayView(page, 15);
	await page.locator(".ch-tg-event", { hasText: "Dentist" }).click();
	await settle(page);
	await page.locator(".ch-details-edit-notes").click();
	expect((await modal(page).textContent()).includes("Saved to Google Calendar."), "says where it's saved");
	await page.fill(".ch-details-notes-field", "Insurance card!");
	await page.locator(".ch-details-notes-buttons .mod-cta").click();
	await settle(page);
	eq(await page.evaluate(() => window.updates), [["g1", "Insurance card!", "Dentist (Google)"]], "description sent to Google, title unchanged");
	await page.locator(".ch-modal-buttons button", { hasText: "Close" }).click();
	// A read-only ICS event: no Edit, no Edit notes.
	await dayView(page, 17);
	await page.locator(".ch-tg-event", { hasText: "UTC lunch" }).click();
	await settle(page);
	eq([await page.locator(".ch-details-edit-notes").count(), await page.locator(".ch-modal-buttons button", { hasText: /^Edit$/ }).count(),
		await page.locator(".ch-modal-buttons button", { hasText: "Copy to local calendar" }).count()], [0, 0, 1], "read-only: nothing to edit");
	await page.locator(".ch-modal-buttons button", { hasText: "Close" }).click();
	// Right-click: both "Show details" and "Edit"; Edit opens the dialog directly.
	await dayView(page, 14);
	await page.locator(".ch-tg-event", { hasText: "Design review" }).click({ button: "right" });
	const items = await page.evaluate(() => window.lastMenu.items.map((i) => i.t));
	expect(items[0] === "Show details" && items[1] === "Edit", `menu: ${items}`);
	await page.evaluate(() => window.lastMenu.items[1].fn());
	await settle(page);
	eq(await page.inputValue(".ch-title-input"), "Design review", "menu Edit → dialog");
	await page.evaluate(() => window.lastModal.close());
	// Setting: clicking opens the edit dialog directly.
	await page.evaluate(() => { plugin.settings.clickOpens = "edit"; });
	await page.locator(".ch-tg-event", { hasText: "Design review" }).click();
	await settle(page);
	eq([await modal(page).count(), await page.locator(".ch-title-input").count()], [0, 1], "setting: dialog directly");
});

test("desktop: task details – tick off, subtasks, Edit notes, its event, Edit", {}, async ({ page }) => {
	await detailsMode(page);
	await page.evaluate(async () => {
		const occ = plugin.store.getOccurrencesForDay(new Date(2026, 10, 14)).find((o) => o.title === "Design review");
		await plugin.tasks.upsert(plugin.tasks.draft({
			title: "Prepare slides", date: "2026-11-14", start: "09:00", end: "09:45", priority: 3, notes: "Use the new template",
			subtasks: [{ id: "s1", title: "Collect numbers", done: false }, { id: "s2", title: "Draft outline", done: true }],
			links: ["Inbox.md"], event: { key: "local:" + occ.eventId, title: occ.title, date: "2026-11-14" },
		}));
		await mountTasks();
	});
	await page.locator('.ch-tasks-nav-item[data-list="today"]').click();
	await page.locator(".ch-task", { hasText: "Prepare slides" }).locator(".ch-task-title").click();
	await settle(page);
	const text = await modal(page).textContent();
	for (const t of ["Prepare slides", "Today", "09:00–09:45", "Tasks", "!!! High priority", "Design review", "Use the new template", "Collect numbers", "1/2", "Inbox"]) {
		expect(text.includes(t), `details show "${t}"`);
	}
	await shot(page, "details-task");
	const task = () => page.evaluate(() => { const t = plugin.tasks.items.find((x) => x.title === "Prepare slides"); return { done: t.done, subs: t.subtasks.map((s) => s.done), notes: t.notes }; });
	await page.locator(".ch-details-subtasks .ch-event-subtask", { hasText: "Collect numbers" }).locator(".ch-task-checkbox").click();
	await settle(page);
	eq((await task()).subs, [true, true], "subtask ticked off in the view");
	await page.locator(".ch-details-edit-notes").click();
	await page.fill(".ch-details-notes-field", "Use the new template, 10 slides max");
	await page.locator(".ch-details-notes-buttons .mod-cta").click();
	await settle(page);
	eq((await task()).notes, "Use the new template, 10 slides max", "notes saved");
	await page.locator(".ch-task-details-title .ch-task-checkbox").click();
	await settle(page);
	eq((await task()).done, true, "task ticked off in the view");
	expect(await page.locator(".ch-task-details-title.is-done").count() === 1, "shown as done");
	// Its event → the event's details.
	await page.locator(".ch-details .ch-task-event-name").click();
	await settle(page);
	eq(await page.locator(".modal .modal-title").last().textContent(), "Design review", "event details opened");
	await page.evaluate(() => window.lastModal.close());
	// Edit → the task dialog.
	await page.evaluate(() => mountTasks());
	await page.locator('.ch-tasks-nav-item[data-list="done"]').click();
	await page.locator(".ch-task", { hasText: "Prepare slides" }).locator(".ch-task-title").click();
	await settle(page);
	await page.locator(".ch-modal-buttons button", { hasText: "Edit" }).click();
	await settle(page);
	eq(await page.inputValue(".ch-title-input"), "Prepare slides", "task dialog");
});

test("mobile: details view by tapping – event and task, Edit notes", { mobile: true }, async ({ page }) => {
	await detailsMode(page);
	await page.evaluate(async () => {
		await plugin.tasks.upsert(plugin.tasks.draft({ title: "Call the plumber", date: "2026-11-14", notes: "Ask about Thursday" }));
	});
	await dayView(page);
	await page.locator(".ch-tg-event", { hasText: "Design review" }).tap();
	await settle(page);
	eq([await modal(page).count(), await page.evaluate(() => __eventMod.EventModal.openCount)], [1, 1], "one details window, nothing else");
	const w = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(w <= 390, `fits the phone: ${w}`);
	await shot(page, "mobile-details-event");
	await page.locator(".ch-details-edit-notes").tap();
	await page.fill(".ch-details-notes-field", "Phone note");
	await page.locator(".ch-details-notes-buttons .mod-cta").tap();
	await settle(page);
	eq(await page.evaluate(() => plugin.data.events.find((e) => e.title === "Design review").description), "Phone note", "saved by tapping");
	await page.locator(".ch-modal-buttons button", { hasText: "Close" }).tap();
	await settle(page);
	// A task from the tasks page.
	await page.evaluate(() => mountTasks());
	await settle(page);
	await page.locator(".ch-task", { hasText: "Call the plumber" }).locator(".ch-task-title").tap();
	await settle(page);
	expect((await modal(page).textContent()).includes("Ask about Thursday"), "task details by tapping");
	await shot(page, "mobile-details-task");
});

};
