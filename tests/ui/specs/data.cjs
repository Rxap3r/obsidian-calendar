/* Data and logic: ICS parsing, local recurrence, task data normalisation. Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, shot, path, SHOTS }) => {

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

};
