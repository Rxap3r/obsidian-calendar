import { setIcon } from "obsidian";
import {
	addDays, addMonths, dayDiff, formatDate, isoWeek, isSameDay, onDay, startOfDay, startOfMonth, startOfWeek, weekdayNames,
} from "../../dateUtils";
import { EventModal } from "../../modals/EventModal";
import { createChip, markDayCell } from "../shared";
import { CalendarHost } from "./host";

/** At most this many events are listed in a day cell of the month grid; the rest is "+N more". */
const MONTH_MAX_CHIPS = 4;

/** The month as a full grid: six weeks, each day with its events as chips. */
export function renderMonth(host: CalendarHost) {
	const { plugin } = host;
	const s = plugin.settings;
	const monthStart = startOfMonth(host.cursor);
	host.setTitle(formatDate(monthStart, { month: "long", year: "numeric" }));
	const gridStart = startOfWeek(monthStart, s.firstDayOfWeek);
	const gridEnd = addDays(gridStart, 42);
	const occs = host.occurrences(gridStart, gridEnd);

	const wrap = host.bodyEl.createDiv({ cls: "ch-month" });
	if (s.showWeekNumbers) wrap.addClass("ch-with-weeknums");
	const head = wrap.createDiv({ cls: "ch-month-head" });
	if (s.showWeekNumbers) head.createDiv({ cls: "ch-weeknum-head", text: "W" });
	for (const n of weekdayNames(s.firstDayOfWeek)) head.createDiv({ cls: "ch-weekday", text: n });

	const grid = wrap.createDiv({ cls: "ch-month-grid" });
	for (let w = 0; w < 6; w++) {
		const row = grid.createDiv({ cls: "ch-month-row" });
		if (s.showWeekNumbers) row.createDiv({ cls: "ch-weeknum", text: String(isoWeek(addDays(gridStart, w * 7 + 3))) });
		for (let d = 0; d < 7; d++) {
			const day = addDays(gridStart, w * 7 + d);
			const cell = row.createDiv({ cls: "ch-month-cell" });
			markDayCell(cell, day, monthStart);

			const header = cell.createDiv({ cls: "ch-cell-head" });
			const num = header.createSpan({ cls: "ch-day-num", text: String(day.getDate()) });
			num.onclick = (e) => {
				e.stopPropagation();
				host.goTo(day, "day");
			};
			const plus = header.createSpan({ cls: "ch-cell-add", attr: { "aria-label": "New event" } });
			setIcon(plus, "plus");
			plus.onclick = (e) => {
				e.stopPropagation();
				new EventModal(plugin, { start: day }).open();
			};

			const list = cell.createDiv({ cls: "ch-cell-events" });
			const dayOccs = onDay(occs, day);
			const shown = dayOccs.length > MONTH_MAX_CHIPS ? MONTH_MAX_CHIPS - 1 : MONTH_MAX_CHIPS;
			dayOccs.slice(0, shown).forEach((o) => {
				const chip = createChip(plugin, list, o, { showTime: true, draggable: true, day });
				if (o.allDay && !isSameDay(o.start, day)) chip.addClass("ch-continued");
			});
			if (dayOccs.length > shown) {
				const more = list.createDiv({ cls: "ch-more", text: `+${dayOccs.length - shown} more` });
				more.onclick = (e) => {
					e.stopPropagation();
					host.goTo(day, "day");
				};
			}
			cell.addEventListener("dblclick", () => new EventModal(plugin, { start: day }).open());
			host.drag.dropTarget(cell, day);
		}
	}
}

/**
 * Narrow month layout (phone, sidebar): a compact 7-column grid that marks events as
 * coloured bars or dots, plus the selected day's events listed below it.
 * Tap a day to select it, double-tap (or tap its heading below) to open the day view.
 */
export function renderMonthCompact(host: CalendarHost, dots: boolean) {
	const s = host.plugin.settings;
	const monthStart = startOfMonth(host.cursor);
	const monthEnd = addMonths(monthStart, 1);
	host.setTitle(formatDate(monthStart, { month: "long", year: "numeric" }));
	const gridStart = startOfWeek(monthStart, s.firstDayOfWeek);
	const weeks = Math.ceil(dayDiff(gridStart, monthEnd) / 7);
	const gridEnd = addDays(gridStart, weeks * 7);
	const occs = host.occurrences(gridStart, gridEnd);
	const today = new Date();
	const inMonth = (d: Date | null) => !!d && d >= monthStart && d < monthEnd;
	const selected = inMonth(host.monthSelected) ? host.monthSelected! : inMonth(today) ? startOfDay(today) : monthStart;

	const wrap = host.bodyEl.createDiv({ cls: `ch-month-compact ${dots ? "ch-dots" : "ch-bars"}` });
	if (s.showWeekNumbers) wrap.addClass("ch-with-weeknums");
	const head = wrap.createDiv({ cls: "ch-mc-row ch-mc-head" });
	if (s.showWeekNumbers) head.createDiv({ cls: "ch-mc-wn", text: "W" });
	for (const n of weekdayNames(s.firstDayOfWeek)) head.createDiv({ cls: "ch-mc-dow", text: dots ? n.slice(0, 2) : n });

	for (let w = 0; w < weeks; w++) {
		const row = wrap.createDiv({ cls: "ch-mc-row" });
		if (s.showWeekNumbers) row.createDiv({ cls: "ch-mc-wn", text: String(isoWeek(addDays(gridStart, w * 7 + 3))) });
		for (let i = 0; i < 7; i++) {
			const day = addDays(gridStart, w * 7 + i);
			const cell = row.createDiv({ cls: "ch-mc-cell" });
			markDayCell(cell, day, monthStart);
			if (isSameDay(day, selected)) cell.addClass("ch-selected");
			cell.createDiv({ cls: "ch-mc-num" }).createSpan({ text: String(day.getDate()) });
			const dayOccs = onDay(occs, day);
			const marks = cell.createDiv({ cls: "ch-mc-marks" });
			if (dots) {
				for (const o of dayOccs.slice(0, 4)) marks.createSpan({ cls: "ch-mc-dot" }).style.setProperty("--ch-event-color", o.color);
			} else {
				const shown = dayOccs.length > 3 ? 2 : 3;
				for (const o of dayOccs.slice(0, shown)) {
					const bar = marks.createDiv({ cls: "ch-mc-bar", text: o.title });
					bar.style.setProperty("--ch-event-color", o.color);
					if (o.allDay) bar.addClass("ch-allday");
					if (o.allDay && !isSameDay(o.start, day)) bar.addClass("ch-continued");
				}
				if (dayOccs.length > shown) marks.createDiv({ cls: "ch-mc-more", text: `+${dayOccs.length - shown}` });
			}
			cell.setAttr("aria-label", `${formatDate(day, { weekday: "long", day: "numeric", month: "long" })}: ${dayOccs.length} events`);
			cell.onclick = () => {
				host.monthSelected = startOfDay(day);
				if (!inMonth(day)) host.cursor = startOfDay(day);
				host.render();
			};
			cell.addEventListener("dblclick", () => host.goTo(day, "day"));
			host.drag.dropTarget(cell, day);
		}
	}

	// The selected day's events.
	const list = wrap.createDiv({ cls: "ch-mc-day" });
	const lh = list.createDiv({ cls: "ch-mc-day-head" });
	const open = lh.createEl("button", { cls: "ch-mc-day-title", text: formatDate(selected, { weekday: "long", day: "numeric", month: "long" }) });
	open.setAttr("aria-label", "Open day view");
	open.onclick = () => host.goTo(selected, "day");
	const add = lh.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "New event" } });
	setIcon(add, "plus");
	add.onclick = () => new EventModal(host.plugin, { start: selected }).open();
	const dayOccs = onDay(occs, selected);
	if (!dayOccs.length) list.createDiv({ cls: "ch-empty", text: "No events" });
	for (const o of dayOccs) {
		const chip = createChip(host.plugin, list, o, { showTime: true, draggable: true, day: selected });
		chip.addClass("ch-mc-item");
	}
}
