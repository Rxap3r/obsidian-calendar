import { addDays, formatDate, formatTime, formatTimeRange, isSameDay, MS_MIN, parseLocal } from "../../dateUtils";
import { HOUR_HEIGHT } from "./layout";

/**
 * Time ranges drawn across the day columns of the week / day grid while the user drags: a new event's
 * selection (`slotSelection.ts`) or an event's new start / end while resizing (`eventResize.ts`).
 */

/** All day columns of the grid this column belongs to (one in the day view, seven in the week view). */
export function dayColumns(col: HTMLElement): HTMLElement[] {
	return Array.from(col.parentElement?.querySelectorAll<HTMLElement>(".ch-tg-col") ?? [col]);
}

/** The day column at this horizontal position; beside the grid, the first or last column. */
export function columnAt(col: HTMLElement, x: number): HTMLElement {
	const cols = dayColumns(col);
	for (const c of cols) {
		const r = c.getBoundingClientRect();
		if (x >= r.left && x < r.right) return c;
	}
	const first = cols[0].getBoundingClientRect();
	return x < first.left ? cols[0] : cols[cols.length - 1];
}

/** The day a column shows (its first moment). */
export function columnDay(col: HTMLElement): Date {
	return parseLocal(col.dataset.date ?? "");
}

/** "12:00 – 13:30", or with weekdays when the range ends on another day: "Mon 12:00 – Tue 06:00". */
export function rangeLabel(start: Date, end: Date, use24h: boolean): string {
	// An end at midnight still belongs to the start day.
	if (isSameDay(start, new Date(end.getTime() - 1))) return formatTimeRange(start, end, use24h);
	const at = (d: Date) => `${formatDate(d, { weekday: "short" })} ${formatTime(d, use24h)}`;
	return `${at(start)} – ${at(end)}`;
}

/**
 * Draw `start`–`end` as one preview block per shown day it touches (class `ch-tg-selection`), the first one with the
 * time label and `title`. Returns the blocks, to be removed by the caller.
 */
export function drawRange(
	col: HTMLElement, start: Date, end: Date, o: { color: string; title: string; use24h: boolean; cls?: string }
): HTMLElement[] {
	const blocks: HTMLElement[] = [];
	for (const c of dayColumns(col)) {
		const dayStart = columnDay(c);
		const dayEnd = addDays(dayStart, 1);
		if (end <= dayStart || start >= dayEnd) continue;
		const a = start > dayStart ? start : dayStart;
		const b = end < dayEnd ? end : dayEnd;
		const top = (a.getTime() - dayStart.getTime()) / MS_MIN / 60 * HOUR_HEIGHT;
		const height = (b.getTime() - a.getTime()) / MS_MIN / 60 * HOUR_HEIGHT;
		const g = c.createDiv({ cls: `ch-tg-selection${o.cls ? ` ${o.cls}` : ""}` });
		g.style.setProperty("--ch-event-color", o.color);
		g.style.top = `${top}px`;
		g.style.height = `${height}px`;
		g.toggleClass("ch-compact", height < 34);
		if (!blocks.length) {
			g.createDiv({ cls: "ch-tg-selection-time", text: rangeLabel(start, end, o.use24h) });
			g.createDiv({ cls: "ch-tg-selection-title", text: o.title });
		} else g.addClass("ch-continued");
		blocks.push(g);
	}
	return blocks;
}
