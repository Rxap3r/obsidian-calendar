import { setIcon } from "obsidian";
import { CalendarOccurrence } from "../../types";
import {
	addDays, dayDiff, formatDate, formatHour, formatTimeRange, isoWeek, isSameDay, MS_DAY, MS_HOUR, onDay, startOfDay,
	startOfWeek, toDateKey,
} from "../../dateUtils";
import { EventModal } from "../../modals/EventModal";
import { createChip, occurrenceMenu, openOccurrence, taskHint, tooltip } from "../shared";
import { CalendarHost } from "./host";
import { HOUR_HEIGHT, HSCROLL_GUTTER, layoutColumns, minutesAt } from "./layout";
import { dayTaskCounter, taskBlock, TaskSlot, timedTaskSlots } from "./tasks";

/**
 * Week / day view: a time grid for `days` days starting at `first`. When only `visible` days fit,
 * the grid scrolls sideways with snapping to each day (mobile / narrow sidebar).
 */
export function renderTimeGrid(host: CalendarHost, first: Date, days: number, visible = days) {
	const { plugin } = host;
	const s = plugin.settings;
	host.setTitle(timeGridTitle(host, first, days));
	const occs = host.occurrences(first, addDays(first, days));
	const allDay = occs.filter((o) => o.allDay || o.end.getTime() - o.start.getTime() >= MS_DAY);
	const timed = occs.filter((o) => !allDay.includes(o));
	const today = new Date();

	const wrap = host.bodyEl.createDiv({ cls: "ch-timegrid" });
	wrap.style.setProperty("--ch-days", String(days));
	const sideways = visible < days;
	if (sideways) {
		wrap.addClass("ch-tg-hscroll");
		wrap.style.setProperty("--ch-visible", String(visible));
		updateDayWidth(host, wrap, visible);
	}

	// Day headers
	const head = wrap.createDiv({ cls: "ch-tg-head" });
	head.createDiv({ cls: "ch-tg-gutter" });
	for (let i = 0; i < days; i++) {
		const day = addDays(first, i);
		const h = head.createDiv({ cls: "ch-tg-dayhead" });
		if (isSameDay(day, today)) h.addClass("ch-today");
		h.createSpan({ cls: "ch-tg-dow", text: formatDate(day, { weekday: "short" }) });
		h.createSpan({ cls: "ch-tg-date", text: String(day.getDate()) });
		if (days > 1) h.onclick = () => host.goTo(day, "day");
	}

	// All-day row
	const adRow = wrap.createDiv({ cls: "ch-tg-allday" });
	adRow.createDiv({ cls: "ch-tg-gutter ch-tg-allday-label", text: "all-day" });
	for (let i = 0; i < days; i++) {
		const day = addDays(first, i);
		const cell = adRow.createDiv({ cls: "ch-tg-allday-cell" });
		// Tasks without a time: one counter for the day.
		dayTaskCounter(plugin, cell, toDateKey(day), false);
		for (const o of onDay(allDay, day)) {
			const chip = createChip(plugin, cell, o, { draggable: true });
			if (!isSameDay(o.start, day)) chip.addClass("ch-continued");
		}
		cell.addEventListener("dblclick", () => new EventModal(plugin, { start: day, allDay: true }).open());
		host.drag.dropTarget(cell, day, null, { clearTaskTime: true });
	}

	// Scrollable hour grid
	const scroll = wrap.createDiv({ cls: "ch-grid-scroll" });
	const inner = scroll.createDiv({ cls: "ch-tg-inner" });
	inner.style.height = `${HOUR_HEIGHT * 24}px`;
	const gutter = inner.createDiv({ cls: "ch-tg-gutter ch-tg-hours" });
	for (let h = 0; h < 24; h++) {
		const lbl = gutter.createDiv({ cls: "ch-tg-hour-label", text: h === 0 ? "" : formatHour(h, s.use24h) });
		lbl.style.top = `${h * HOUR_HEIGHT}px`;
	}
	const cols = inner.createDiv({ cls: "ch-tg-cols" });
	for (let i = 0; i < days; i++) {
		const day = addDays(first, i);
		const col = cols.createDiv({ cls: "ch-tg-col" });
		col.dataset.date = toDateKey(day);
		if (isSameDay(day, today)) col.addClass("ch-today");
		for (let h = 0; h < 24; h++) {
			col.createDiv({ cls: "ch-tg-hourline" }).style.top = `${h * HOUR_HEIGHT}px`;
		}
		// A new event starts in the 15-minute slot that was pressed.
		host.slots.enable(col, day, (clientY) => minutesAt(col, clientY, Math.floor));
		host.drag.timeColumn(col, day);

		const dayStart = startOfDay(day);
		const dayEnd = addDays(dayStart, 1);
		// Events and timed tasks share the columns, so they never cover each other.
		const items: (CalendarOccurrence | TaskSlot)[] = [...onDay(timed, day), ...timedTaskSlots(plugin, toDateKey(day))];
		for (const { occ: item, colIdx, colCount } of layoutColumns(items, dayStart, dayEnd)) {
			if ("task" in item) taskBlock(host, col, item, { colIdx, colCount });
			else eventBlock(host, col, item, { dayStart, dayEnd, colIdx, colCount, now: today });
		}
	}
	updateNowLine(host.bodyEl);

	// Restore or set initial scroll position.
	window.requestAnimationFrame(() => {
		// Align the header columns with the scrollable body (scrollbar width).
		wrap.style.setProperty("--ch-scrollbar", `${scroll.offsetWidth - scroll.clientWidth}px`);
		if (host.scrollTop !== null) {
			scroll.scrollTop = host.scrollTop;
		} else {
			const showsToday = days <= 7 && dayDiff(first, today) >= 0 && dayDiff(first, today) < days;
			const h = showsToday ? Math.max(0, today.getHours() - 2) : s.scrollToHour;
			scroll.scrollTop = h * HOUR_HEIGHT;
			host.scrollTop = scroll.scrollTop;
		}
	});
	scroll.addEventListener("scroll", () => (host.scrollTop = scroll.scrollTop));

	if (sideways) scrollSideways(host, { wrap, head, scroll, first, days, visible });
}

/** The toolbar title: the day, the week's month, or the exact range – always with the week number. */
function timeGridTitle(host: CalendarHost, first: Date, days: number): string {
	const last = addDays(first, days - 1);
	if (days === 1) {
		return `${formatDate(first, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · W${weekNumber(host, first)}`;
	}
	if (days < 7) {
		// Shortened week (narrow view): exact date range plus the week number(s).
		const weeks = Array.from(new Set(Array.from({ length: days }, (_, i) => weekNumber(host, addDays(first, i)))));
		const range = first.getMonth() === last.getMonth()
			? `${formatDate(first, { day: "numeric", month: "short" })} – ${formatDate(last, { day: "numeric" })}, ${last.getFullYear()}`
			: `${formatDate(first, { day: "numeric", month: "short" })} – ${formatDate(last, { day: "numeric", month: "short", year: "numeric" })}`;
		return `${range} · W${weeks.length > 1 ? `${weeks[0]}–${weeks[weeks.length - 1]}` : weeks[0]}`;
	}
	const week = isoWeek(addDays(first, 3));
	if (first.getMonth() === last.getMonth()) return `${formatDate(first, { month: "long", year: "numeric" })} · W${week}`;
	return `${formatDate(first, { month: "short" })} – ${formatDate(last, { month: "short", year: "numeric" })} · W${week}`;
}

/** ISO week number of the (configured) week containing this day – same numbering as the month grid. */
function weekNumber(host: CalendarHost, d: Date): number {
	return isoWeek(addDays(startOfWeek(d, host.plugin.settings.firstDayOfWeek), 3));
}

/** One timed event in a day column: a block positioned by its time, next to events that overlap it. */
function eventBlock(
	host: CalendarHost, col: HTMLElement, occ: CalendarOccurrence,
	at: { dayStart: Date; dayEnd: Date; colIdx: number; colCount: number; now: Date }
) {
	const { plugin } = host;
	const s = plugin.settings;
	// The part of the event that lies on this day.
	const segStart = occ.start < at.dayStart ? at.dayStart : occ.start;
	const segEnd = occ.end > at.dayEnd ? at.dayEnd : occ.end;
	const top = ((segStart.getTime() - at.dayStart.getTime()) / MS_HOUR) * HOUR_HEIGHT;
	const height = Math.max(((segEnd.getTime() - segStart.getTime()) / MS_HOUR) * HOUR_HEIGHT, 18);
	const el = col.createDiv({ cls: "ch-tg-event" });
	el.style.setProperty("--ch-event-color", occ.color);
	el.style.top = `${top}px`;
	el.style.height = `${height - 2}px`;
	el.style.left = `calc(${(at.colIdx / at.colCount) * 100}% + 1px)`;
	el.style.width = `calc(${(1 / at.colCount) * 100}% - 3px)`;
	if (occ.readOnly) el.addClass("ch-readonly");
	if (occ.end < at.now) el.addClass("ch-past");
	if (height < 36) el.addClass("ch-compact");
	const title = el.createDiv({ cls: "ch-tg-event-title", text: occ.title });
	taskHint(plugin, title, occ);
	el.createDiv({
		cls: "ch-tg-event-time",
		text: `${formatTimeRange(occ.start, occ.end, s.use24h)}${occ.location ? ` · ${occ.location}` : ""}`,
	});
	el.setAttr("title", tooltip(plugin, occ));
	el.addEventListener("pointerdown", (e) => e.stopPropagation());
	el.addEventListener("click", (e) => {
		e.stopPropagation();
		openOccurrence(plugin, occ);
	});
	el.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
		occurrenceMenu(plugin, occ, e);
	});
	host.drag.grabbable(el, occ, segStart);
}

/**
 * The week that scrolls sideways (not all days fit): the header and all-day row follow the scroll of
 * the hour grid, and scroll indicators show that there is more – arrows, a week bar that marks the
 * visible days, and edge shadows on the grid.
 */
function scrollSideways(
	host: CalendarHost,
	g: { wrap: HTMLElement; head: HTMLElement; scroll: HTMLElement; first: Date; days: number; visible: number }
) {
	const { wrap, scroll } = g;
	const bar = wrap.createDiv({ cls: "ch-week-bar" });
	g.head.after(bar);
	const prevBtn = bar.createEl("button", { cls: "ch-hs-arrow ch-hs-prev", attr: { "aria-label": "Previous day" } });
	setIcon(prevBtn, "chevron-left");
	const track = bar.createDiv({ cls: "ch-week-bar-track", attr: { "aria-hidden": "true" } });
	const segs = Array.from({ length: g.days }, () => track.createSpan({ cls: "ch-week-bar-seg" }));
	const nextBtn = bar.createEl("button", { cls: "ch-hs-arrow ch-hs-next", attr: { "aria-label": "Next day" } });
	setIcon(nextBtn, "chevron-right");
	const scrollByDay = (dir: number) => scroll.scrollBy({ left: dir * dayWidth(wrap), behavior: "smooth" });
	prevBtn.onclick = () => scrollByDay(-1);
	nextBtn.onclick = () => scrollByDay(1);
	const indicators = () => {
		const dayW = dayWidth(wrap);
		const max = scroll.scrollWidth - scroll.clientWidth;
		const sl = scroll.scrollLeft;
		prevBtn.toggleClass("is-hidden", sl <= 2);
		nextBtn.toggleClass("is-hidden", sl >= max - 2);
		wrap.toggleClass("ch-more-left", sl > 2);
		wrap.toggleClass("ch-more-right", sl < max - 2);
		if (dayW > 0) {
			const firstIdx = Math.round(sl / dayW);
			segs.forEach((seg, i) => seg.toggleClass("is-visible", i >= firstIdx && i < firstIdx + g.visible));
		}
	};
	const sync = () => {
		// Shift header / all-day cells by the exact scroll offset (works during overscroll too).
		wrap.style.setProperty("--ch-sx", `${scroll.scrollLeft}px`);
		indicators();
	};
	let settle: number | null = null;
	scroll.addEventListener("scroll", () => {
		sync();
		// Remember the first visible day so re-renders keep the position.
		if (settle !== null) window.clearTimeout(settle);
		settle = window.setTimeout(() => {
			const dayW = dayWidth(wrap);
			if (dayW > 0) host.cursor = addDays(g.first, Math.round(scroll.scrollLeft / dayW));
		}, 150);
	});
	// Start with the cursor day (e.g. today) as the first visible day.
	window.requestAnimationFrame(() => {
		const idx = Math.max(0, Math.min(g.days - g.visible, dayDiff(g.first, host.cursor)));
		scroll.scrollLeft = idx * dayWidth(wrap);
		sync();
	});
}

/** Width of one day column in the week that scrolls sideways. */
function dayWidth(wrap: HTMLElement): number {
	return parseFloat(wrap.style.getPropertyValue("--ch-day-w")) || 0;
}

/** Set the width of the day columns so that `visible` of them fill the view. */
export function updateDayWidth(host: CalendarHost, wrap: HTMLElement, visible: number) {
	const w = Math.max(0, (host.width || host.bodyEl.clientWidth) - HSCROLL_GUTTER);
	wrap.style.setProperty("--ch-day-w", `${Math.floor(w / visible)}px`);
}

/** The line that marks the current time in today's column (if today is shown). */
export function updateNowLine(bodyEl: HTMLElement) {
	bodyEl.querySelectorAll(".ch-now-line").forEach((n) => n.remove());
	const now = new Date();
	const col = bodyEl.querySelector<HTMLElement>(`.ch-tg-col[data-date="${toDateKey(now)}"]`);
	if (!col) return;
	const line = col.createDiv({ cls: "ch-now-line" });
	line.style.top = `${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT}px`;
}
