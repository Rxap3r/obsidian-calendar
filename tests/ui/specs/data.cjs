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
			{ id: "a", title: "ok", listId: "w", priority: 9, date: "2026-11-14", start: "10:00", end: "09:00", subtasks: [{ id: "x", title: "s", description: "  short  ", links: ["n.md", 5] }, null], links: ["a.md", 3],
				log: [{ id: "l2", at: 2000, text: "second" }, { at: 1000, text: "first" }, { at: "x", text: "bad" }, { at: 3000, text: "  " }, null] },
			{ id: "b", title: "orphan", listId: "gone", start: "10:00" }, null ] } };
		await plugin.loadPluginData();
		return { lists: plugin.data.tasks.lists.map((l) => l.id), a: plugin.data.tasks.items[0], b: plugin.data.tasks.items[1] };
	});
	eq(r.lists, ["tasks", "w"], "default list added");
	eq([r.a.priority, r.a.subtasks.length, r.a.links], [0, 1, ["a.md"]], "bad fields fixed");
	eq([r.a.subtasks[0].description, r.a.subtasks[0].links], ["short", ["n.md"]], "subtask description trimmed, bad note paths dropped");
	eq([r.b.listId, r.b.start ?? null], ["tasks", null], "orphan → default list, time without date dropped");
	eq([r.a.log.map((e) => e.text), typeof r.a.log[0].id, r.b.log ?? null], [["first", "second"], "string", null], "progress log: bad entries dropped, oldest first, ids added");
});

test("local recurrence: a series that started many years ago still shows up, on the right days", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const add = (e) => plugin.store.addEvent({ calendarId: "personal", allDay: false, exdates: [], ...e });
		// More than 5000 repeats ago: such a series used to disappear.
		await add({ title: "Old daily", start: "2005-01-01T07:00", end: "2005-01-01T07:30", recurrence: { freq: "daily", interval: 1 } });
		await add({ title: "Old fortnight", start: "2010-01-04T08:00", end: "2010-01-04T09:00", recurrence: { freq: "weekly", interval: 2 } });
		await add({ title: "Old month end", start: "2015-01-31T08:00", end: "2015-01-31T09:00", recurrence: { freq: "monthly", interval: 1 } });
		await add({ title: "Old leap day", allDay: true, start: "2016-02-29", end: "2016-02-29", recurrence: { freq: "yearly", interval: 1 } });
		await add({ title: "Old trip", allDay: true, start: "2012-01-06", end: "2012-01-08", recurrence: { freq: "weekly", interval: 1 } });
		await add({ title: "Old ended", start: "2005-01-01T06:00", end: "2005-01-01T06:30", recurrence: { freq: "daily", interval: 1, until: "2026-11-10" } });
		await add({ title: "Old ten times", start: "2005-01-01T05:00", end: "2005-01-01T05:30", recurrence: { freq: "daily", interval: 1, count: 10 } });
		const { toDateKey } = window.__dateMod;
		const starts = (from, to, title) => plugin.store.getOccurrences(from, to).filter((o) => o.title === title).map((o) => toDateKey(o.start));
		const week = [new Date(2026, 10, 9), new Date(2026, 10, 16)];
		const nov = [new Date(2026, 10, 1), new Date(2026, 11, 1)];
		return {
			daily: starts(...week, "Old daily"),
			fortnightWeek: starts(...week, "Old fortnight"), fortnightNov: starts(...nov, "Old fortnight"),
			monthEnd: starts(...nov, "Old month end"),
			leap: starts(new Date(2027, 1, 1), new Date(2027, 2, 1), "Old leap day"),
			trip: starts(...week, "Old trip"),
			// The trip that started on Friday 6 Nov still covers Sunday 8 Nov.
			tripSunday: starts(new Date(2026, 10, 8), new Date(2026, 10, 9), "Old trip"),
			ended: starts(...week, "Old ended"), ten: starts(...week, "Old ten times"),
		};
	});
	eq(r.daily, ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"], "daily since 2005: every day of the week");
	eq([r.fortnightWeek, r.fortnightNov], [[], ["2026-11-02", "2026-11-16", "2026-11-30"]], "every 2 weeks since 2010");
	eq(r.monthEnd, ["2026-11-30"], "monthly on the 31st → last day of a shorter month");
	eq(r.leap, ["2027-02-28"], "yearly on 29 Feb");
	eq([r.trip, r.tripSunday], [["2026-11-13"], ["2026-11-06"]], "weekly 3-day event, also when it began before the range");
	eq([r.ended, r.ten], [["2026-11-09", "2026-11-10"], []], "'until' and 'count' still end the series");
});

test("data: settings are checked and migrated on load", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const load = async (settings, extra = {}) => { plugin._data = { settings, events: [], ...extra }; await plugin.loadPluginData(); return plugin.settings; };
		const out = {};
		// Saved by ≤ 1.5.1: "sidebarOnStartup" becomes "sidebarView".
		let s = await load({ sidebarOnStartup: "full" });
		out.migrated = [s.sidebarView, "sidebarOnStartup" in s];
		// Broken or out-of-range values fall back to something valid.
		s = await load({ sidebarCalendarMode: "year", sidebarOnExpand: "x", sidebarAfterClose: 5, sidebarUpcomingDays: 9999, tasksDefaultPriority: 7,
			tasksUpcomingDays: 0, tasksDoneVisibleDays: 0, tasksDeleteDoneAfterDays: -3, tasksDefaultListId: "gone", defaultCalendarId: "gone", defaultTargets: ["gone"],
			sources: [{ id: "a", name: "A", color: "#111111", type: "local", enabled: true }, { id: "g", name: "G", color: "#222222", type: "google", enabled: true, accountId: "missing" }] });
		out.fixed = [s.sidebarCalendarMode, s.sidebarOnExpand, s.sidebarAfterClose, s.sidebarUpcomingDays, s.tasksDefaultPriority, s.tasksUpcomingDays,
			s.tasksDoneVisibleDays, s.tasksDeleteDoneAfterDays, s.tasksDefaultListId, s.defaultCalendarId, s.defaultTargets, s.sources.map((x) => x.id)];
		// Special values survive: -1 = "everything" / "same as agenda".
		s = await load({ sidebarUpcomingDays: -1, tasksDoneVisibleDays: -1, tasksDeleteDoneAfterDays: 90 });
		out.special = [s.sidebarUpcomingDays, s.tasksDoneVisibleDays, s.tasksDeleteDoneAfterDays];
		// Nothing saved yet: defaults, one local calendar.
		plugin._data = null; await plugin.loadPluginData();
		out.fresh = [plugin.settings.defaultView, plugin.settings.sources.map((x) => x.id), plugin.settings.defaultTargets, plugin.data.tasks.lists.map((l) => l.id)];
		return out;
	});
	eq(r.migrated, ["full", false], "sidebarOnStartup → sidebarView");
	eq(r.fixed, ["day", "mini", "", 365, 0, 1, 30, 0, "tasks", "a", ["a"], ["a"]], "invalid values repaired, calendar without account dropped");
	eq(r.special, [-1, -1, 90], "special values kept");
	eq(r.fresh, ["month", ["personal"], ["personal"], ["tasks"]], "first start");
});


test("data: event notes are migrated, event links and task events checked on load", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		plugin._data = {
			settings: {},
			events: [{ id: "e1", calendarId: "personal", title: "Old", allDay: true, start: "2026-11-14", end: "2026-11-14", notePath: "Inbox.md" },
				{ id: "e2", calendarId: "personal", title: "Both", allDay: true, start: "2026-11-14", end: "2026-11-14", notePath: "A.md", links: ["A.md", "B.md", 3] }],
			eventLinks: { "gcal:g1": ["Inbox.md", "Inbox.md", null], "gcal:empty": [], bad: "x" },
			tasks: { items: [{ id: "t1", title: "x", event: { key: "local:e1", title: "Old", date: "2026-11-14" } }, { id: "t2", title: "y", event: { key: "", date: "x" } }] },
		};
		await plugin.loadPluginData();
		const d = plugin.data;
		return { events: d.events.map((e) => [e.links, "notePath" in e]), links: d.eventLinks, tasks: d.tasks.items.map((t) => t.event ?? null),
			fresh: (plugin._data = null, await plugin.loadPluginData(), [plugin.data.eventLinks, plugin.settings.tasksInCalendar, plugin.settings.tasksCalendarShowDone, plugin.settings.tasksInMiniCalendar, plugin.settings.tasksProgressLog, plugin.settings.tasksNoteExtras, plugin.settings.tasksSubtaskExtras]) };
	});
	eq(r.events, [[["Inbox.md"], false], [["A.md", "B.md"], false]], "notePath → links (≤ 1.7)");
	eq(r.links, { "gcal:g1": ["Inbox.md"] }, "event links: duplicates, empty and broken entries dropped");
	eq(r.tasks, [{ key: "local:e1", title: "Old", date: "2026-11-14" }, null], "task event links checked");
	eq(r.fresh, [{}, true, true, true, true, true, true], "defaults");
});

};
