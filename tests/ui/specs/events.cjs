/* Event dialog and remote events (Google/Outlook). Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, shot, path, SHOTS }) => {

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

test("events: all-day event created late in the evening covers one day only", {}, async ({ page }) => {
	// Like creating an event at ~22:30: suggested 23:00 – 00:00 (next day), then "All day" switched on.
	await page.evaluate(() => { const { EventModal } = window.__eventMod; new EventModal(plugin, { start: new Date(2026, 10, 16, 23, 0), end: new Date(2026, 10, 17, 0, 0) }).open(); });
	await page.waitForTimeout(100);
	eq(await page.textContent(".ch-event-end-date"), "Tue, Nov 17, 2026", "timed end is midnight = Tuesday");
	await page.evaluate(() => [...document.querySelectorAll(".setting-item")].find((x) => x.textContent.startsWith("All day")).querySelector(".checkbox-container").click());
	eq(await page.textContent(".ch-event-end-date"), "Mon, Nov 16, 2026", "all day: ends Monday");
	await page.fill(".ch-title-input", "Late all-day");
	await page.evaluate(() => [...document.querySelectorAll(".ch-modal-buttons button.mod-cta")].pop().click());
	await page.waitForTimeout(150);
	const r = await page.evaluate(() => {
		const e = plugin.data.events.find((x) => x.title === "Late all-day");
		const days = plugin.store.getOccurrences(new Date(2026, 10, 15), new Date(2026, 10, 19)).filter((o) => o.title === "Late all-day");
		const { overlapsDay } = window.__dateMod;
		const on = [16, 17].map((d) => days.some((o) => overlapsDay(o.start, o.end, new Date(2026, 10, d))));
		return { start: e.start, end: e.end, on };
	});
	eq(r, { start: "2026-11-16", end: "2026-11-16", on: [true, false] }, "saved and shown on Monday only");
	// default suggestion late in the evening stays on the same day
	const d = await page.evaluate(() => { const x = plugin.store.defaultTimes(new Date(2026, 10, 16), 23); return [x.start.getHours(), x.end.getDate(), x.end.getHours(), x.end.getMinutes()]; });
	eq(d, [23, 16, 23, 59], "23:00 suggestion ends 23:59 the same day");
});

};
