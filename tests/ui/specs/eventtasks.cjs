/* Tasks on events and linked notes on events (1.8). Loaded by tests/ui/run.cjs – see tests/README.md. */
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

};
