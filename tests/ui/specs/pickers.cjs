/* Own date/time pickers and the dialog focus rules (tablet keyboard bugs). Loaded by tests/ui/run.cjs – see tests/README.md. */
module.exports = ({ test, expect, eq, shot, path, SHOTS }) => {

test("time picker: typing, list, 12-hour clock, invalid input, phone mode", {}, async ({ page }) => {
	const r = await page.evaluate(async () => {
		const { parseTimeInput } = window.__timeMod;
		return ["1030", "10:30", "9", "930", "2:30pm", "12am", "12 pm", "7.15", "25:00", "abc", "10:75"].map((s) => parseTimeInput(s));
	});
	eq(r, ["10:30", "10:30", "09:00", "09:30", "14:30", "00:00", "12:00", "07:15", null, null, null], "parsing");
	await page.evaluate(() => { plugin.settings.use24h = false; new TaskModal(plugin, undefined, { date: "2026-11-14" }).open(); });
	await page.waitForTimeout(100);
	await page.click(".ch-task-start input");
	eq(await page.$$eval(".ch-time-list [data-value]", (e) => e.length), 96, "96 quarter-hour steps");
	eq(await page.$eval('.ch-time-list [data-value="14:30"]', (e) => e.textContent), "2:30 PM", "12-hour labels");
	await page.keyboard.type("nonsense");
	await page.keyboard.press("Enter");
	eq(await page.inputValue(".ch-task-start input"), "", "invalid input is rejected");
	await page.click(".ch-task-start input");
	await page.keyboard.type("9:05pm");
	await page.keyboard.press("Enter");
	eq(await page.inputValue(".ch-task-start input"), "9:05 PM", "exact minutes can be typed");
	await page.screenshot({ path: path.join(SHOTS, "time-picker-desktop.png") });
});

test("mobile: time picker list first, 'Type a time', event dialog keeps duration", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => new TaskModal(plugin, undefined, { date: "2026-11-14" }).open());
	await page.waitForTimeout(100);
	eq(await page.$eval(".ch-task-start input", (e) => e.readOnly), true, "no keyboard by default on phones");
	await page.tap(".ch-task-start input");
	await page.waitForTimeout(80);
	const box = await page.evaluate(() => {
		const list = document.querySelector(".ch-time-list"); const l = list.getBoundingClientRect();
		const type = list.querySelector(".ch-time-type").getBoundingClientRect();
		return { inside: l.left >= 0 && l.right <= innerWidth && l.top >= 0 && l.bottom <= innerHeight, typeVisible: type.top >= l.top - 1 && type.bottom <= l.bottom, scrolled: list.scrollTop > 0 };
	});
	eq(box, { inside: true, typeVisible: true, scrolled: true }, "list fully on screen; 'Type a time' stays visible while scrolled to the current time");
	await page.screenshot({ path: path.join(SHOTS, "time-picker-mobile.png") });
	await page.tap('.ch-time-list [data-value="09:30"]');
	eq(await page.inputValue(".ch-task-start input"), "09:30", "tap picks a time");
	await page.evaluate(() => window.lastModal.close());
	// Event dialog: moving the start keeps the duration (end follows)
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await page.evaluate(() => { const { EventModal } = window.__eventMod; new EventModal(plugin, { start: new Date(2026, 10, 14, 10, 0), end: new Date(2026, 10, 14, 11, 0) }).open(); });
	await page.waitForTimeout(100);
	await page.tap(".ch-event-start-time input");
	await page.tap('.ch-time-list [data-value="13:00"]');
	eq(await page.inputValue(".ch-event-end-time input"), "14:00", "end moved with the start");
	await page.tap(".ch-event-end-time input");
	eq(await page.$eval('.ch-time-list [data-value="14:30"]', (e) => e.textContent), "14:30  ·  1 h 30 min", "event end list shows durations");
});

test("date picker: month calendar, first day of week, navigation, no date", {}, async ({ page }) => {
	await page.evaluate(() => { plugin.settings.firstDayOfWeek = 1; new TaskModal(plugin).open(); });
	await page.waitForTimeout(100);
	eq(await page.textContent(".ch-task-date"), "Select date", "empty");
	await page.click(".ch-task-date button");
	const r = await page.evaluate(() => {
		const p = document.querySelector(".ch-date-popup");
		return { title: p.querySelector(".ch-date-title").textContent, wd: [...p.querySelectorAll(".ch-date-wd")].map((e) => e.textContent).join(""),
			first: p.querySelector(".ch-date-day").dataset.date, today: p.querySelector(".ch-today")?.dataset.date, days: p.querySelectorAll(".ch-date-day").length };
	});
	eq(r, { title: "November 2026", wd: "MTWTFSS", first: "2026-10-26", today: "2026-11-14", days: 42 }, "month grid (Monday first, 6 weeks)");
	await page.screenshot({ path: path.join(SHOTS, "date-picker-desktop.png") });
	await page.click('.ch-date-nav[aria-label="Next month"]');
	eq(await page.textContent(".ch-date-title"), "December 2026", "next month");
	await page.click('.ch-date-day[data-date="2026-12-24"]');
	eq(await page.evaluate(() => [document.querySelector(".ch-task-date").textContent, !!document.querySelector(".ch-date-popup"), window.lastModal.task.date]), ["Thu, Dec 24, 2026", false, "2026-12-24"], "picked, popup closed");
	expect(await page.isVisible(".ch-task-time-setting"), "time row appears once a date is set");
	await page.click(".ch-task-date button");
	await page.click('.ch-date-foot button:text("No date")');
	eq(await page.evaluate(() => [document.querySelector(".ch-task-date").textContent, window.lastModal.task.date ?? null]), ["Select date", null], "No date clears");
	// Sunday-first setting
	await page.evaluate(() => { window.lastModal.close(); plugin.settings.firstDayOfWeek = 0; new TaskModal(plugin).open(); });
	await page.click(".ch-task-date button");
	eq(await page.$eval(".ch-date-popup", (p) => [...p.querySelectorAll(".ch-date-wd")].map((e) => e.textContent).join("")), "SMTWTFS", "Sunday first");
});

test("mobile: date picker fits on screen; event dialog dates + until", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => { const { EventModal } = window.__eventMod; new EventModal(plugin, { start: new Date(2026, 10, 14, 10, 0), end: new Date(2026, 10, 14, 11, 0) }).open(); });
	await page.waitForTimeout(100);
	await page.tap(".ch-event-start-date button");
	await page.waitForTimeout(80);
	const box = await page.evaluate(() => { const l = document.querySelector(".ch-date-popup").getBoundingClientRect(); return l.left >= 0 && l.right <= innerWidth && l.top >= 0 && l.bottom <= innerHeight; });
	eq(box, true, "calendar fully on screen");
	await page.screenshot({ path: path.join(SHOTS, "date-picker-mobile.png") });
	await page.tap('.ch-date-day[data-date="2026-11-20"]');
	eq(await page.evaluate(() => [document.querySelector(".ch-event-end-date").textContent, document.querySelector(".ch-event-end-time input").value]), ["Fri, Nov 20, 2026", "11:00"], "end date follows the start");
	// repeat until
	await page.selectOption(".ch-repeat-row select", "weekly");
	await page.waitForTimeout(50);
	await page.evaluate(() => { const s = [...document.querySelectorAll(".setting-item")].find((x) => x.textContent.startsWith("Ends") && x.querySelector("select")).querySelector("select"); s.value = "until"; s.dispatchEvent(new Event("change")); });
	await page.tap(".ch-until button");
	await page.tap('.ch-date-nav[aria-label="Next month"]');
	await page.tap('.ch-date-day[data-date="2026-12-18"]');
	await page.fill(".ch-title-input", "Weekly");
	await page.evaluate(() => [...document.querySelectorAll(".ch-modal-buttons button.mod-cta")].pop().click());
	await page.waitForTimeout(150);
	eq(await page.evaluate(() => { const e = plugin.data.events.find((x) => x.title === "Weekly"); return [e.start, e.recurrence?.until]; }), ["2026-11-20T10:00", "2026-12-18"], "saved with picked dates");
});

test("mobile: picking dates/times never jumps to the title field (no keyboard)", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => {
		new TaskModal(plugin).open();
		// Mimic Obsidian: focus that leaves the open dialog is pulled back to its first field.
		window.titleFocus = 0;
		const title = () => document.querySelector(".ch-task-modal .ch-title-input");
		document.addEventListener("focusin", (e) => { if (!e.target.closest(".modal-container")) title().focus(); }, true);
		setTimeout(() => { title().blur(); title().addEventListener("focus", () => window.titleFocus++); }, 50);
	});
	await page.waitForTimeout(120);
	await page.tap(".ch-task-date button");
	await page.tap('.ch-date-nav[aria-label="Next month"]');
	await page.tap('.ch-date-day[data-date="2026-12-03"]');
	await page.tap(".ch-task-start input");
	await page.tap('.ch-time-list [data-value="09:00"]');
	await page.tap(".ch-task-end input");
	const inside = await page.$eval(".ch-time-list", (e) => !!e.closest(".modal-container"));
	await page.tap('.ch-time-list [data-value="10:00"]');
	await page.waitForTimeout(100);
	const pickFocus = await page.evaluate(() => window.titleFocus);
	await page.fill(".ch-task-add-sub", "Sub"); await page.press(".ch-task-add-sub", "Enter");
	await page.evaluate(() => document.activeElement.blur());
	await page.evaluate(() => (window.titleFocus = 0));
	await page.tap(".ch-task-sub-row .ch-icon-btn");
	await page.waitForTimeout(100);
	const r = await page.evaluate(() => ({ titleFocus: window.titleFocus, active: document.activeElement.className, task: [window.lastModal.task.date, window.lastModal.task.start, window.lastModal.task.end] }));
	eq([inside, pickFocus, r.titleFocus, r.task], [true, 0, 0, ["2026-12-03", "09:00", "10:00"]], "pop-ups live in the dialog, title never refocused (pickers, subtask delete), values picked");
	// "Type a time" fully visible
	await page.tap(".ch-task-start input");
	const tw = await page.$eval(".ch-time-type", (e) => e.scrollWidth <= e.clientWidth + 1);
	eq(tw, true, "'Type a time' not cut off");
	await page.screenshot({ path: path.join(SHOTS, "time-picker-mobile-type.png") });
});

test("mobile: event dialog – date/time pickers never jump to the title field", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => {
		const { EventModal } = window.__eventMod;
		new EventModal(plugin, { start: new Date(2026, 10, 14, 10, 0), end: new Date(2026, 10, 14, 11, 0) }).open();
		window.titleFocus = 0;
		const title = () => document.querySelector(".ch-event-modal .ch-title-input");
		document.addEventListener("focusin", (e) => { if (!e.target.closest(".modal-container")) title().focus(); }, true);
		setTimeout(() => { title().blur(); title().addEventListener("focus", () => window.titleFocus++); }, 50);
	});
	await page.waitForTimeout(120);
	await page.tap(".ch-event-start-date button");
	await page.tap('.ch-date-nav[aria-label="Next month"]');
	await page.tap('.ch-date-day[data-date="2026-12-03"]');
	await page.tap(".ch-event-start-time input");
	await page.tap('.ch-time-list [data-value="09:00"]');
	await page.tap(".ch-event-end-date button");
	await page.tap('.ch-date-day[data-date="2026-12-04"]');
	await page.tap(".ch-event-end-time input");
	await page.tap('.ch-time-list [data-value="12:00"]');
	await page.tap(".ch-target-chip >> nth=1");
	await page.waitForTimeout(100);
	const r = await page.evaluate(() => ({ titleFocus: window.titleFocus, start: document.querySelector(".ch-event-start-date").textContent, end: document.querySelector(".ch-event-end-date").textContent }));
	eq(r, { titleFocus: 0, start: "Thu, Dec 3, 2026", end: "Fri, Dec 4, 2026" }, "title never refocused in the event dialog");
});

test("mobile: after typing in notes/subtasks, tapping buttons closes the keyboard (no jump back)", { mobile: true }, async ({ page }) => {
	await page.evaluate(() => {
		new TaskModal(plugin).open();
		window.titleFocus = 0;
		const title = () => document.querySelector(".ch-task-modal .ch-title-input");
		document.addEventListener("focusin", (e) => { if (!e.target.closest(".modal-container")) title().focus(); }, true);
		setTimeout(() => { title().blur(); title().addEventListener("focus", () => window.titleFocus++); }, 50);
	});
	await page.waitForTimeout(120);
	const active = () => page.evaluate(() => { const a = document.activeElement; return a.classList.contains("ch-task-modal") ? "dialog" : a.tagName.toLowerCase() + "." + [...a.classList].join("."); });
	// type in Notes, then pick a date
	await page.tap(".ch-description-setting textarea");
	await page.keyboard.type("Bring laptop");
	await page.tap(".ch-task-date button");
	eq(await active(), "dialog", "notes field let go when tapping the date");
	await page.tap('.ch-date-nav[aria-label="Next month"]');
	await page.tap('.ch-date-day[data-date="2026-12-24"]');
	// type in a subtask, then tap a priority button
	await page.tap(".ch-task-add-sub");
	await page.keyboard.type("Step");
	await page.tap(".ch-prio-seg .ch-prio-2");
	eq(await active(), "dialog", "subtask field let go when tapping a priority");
	// type in Notes again, then pick a time from the list
	await page.tap(".ch-description-setting textarea");
	await page.tap(".ch-task-start input");
	eq(await active(), "input.ch-input.ch-timefield-input", "time field (read-only on phones, no keyboard) has the focus");
	await page.tap('.ch-time-list [data-value="10:00"]');
	const r = await page.evaluate(() => ({ titleFocus: window.titleFocus, t: [window.lastModal.task.date, window.lastModal.task.start, window.lastModal.task.priority, window.lastModal.task.notes] }));
	eq(r, { titleFocus: 0, t: ["2026-12-24", "10:00", 2, "Bring laptop"] }, "no jump to the title; values kept");
});

};
