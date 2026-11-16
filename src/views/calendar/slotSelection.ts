import type OmniCalendarPlugin from "../../main";
import { addDays, addMinutes, formatDate, formatTime, formatTimeRange, isSameDay, MS_MIN, parseLocal, startOfDay } from "../../dateUtils";
import { EventModal } from "../../modals/EventModal";
import { HOUR_HEIGHT, SNAP_MIN } from "./layout";

/** Touch: hold this long before dragging selects a time range. */
const LONG_PRESS_MS = 400;
/** Touch: movement (px) that counts as scrolling instead of a tap / long press. */
const TOUCH_SLOP = 8;

/**
 * Create events from empty time slots in the week / day grid.
 * Mouse / pen: press and drag to select a range, or click for a default-length event. In the week view the
 * range can continue into the following (or previous) days: drag into another day column.
 * Touch: swipe scrolls as usual; tap opens "new event" at that time; press and hold
 * (~0.4 s), then drag to select a range. Only one selection can be active and only
 * one event dialog is opened; cancelled gestures (e.g. the browser starting to scroll)
 * are always cleaned up.
 */
export class SlotSelection {
	/** The time-slot selection in progress (at most one). */
	private active: { cancel: () => void } | null = null;

	constructor(private plugin: OmniCalendarPlugin) {}

	/** Drop a selection in progress (the view is about to be redrawn). */
	cancel() {
		this.active?.cancel();
	}

	/** Let the user create events in this day column. `minutesFromY` turns a screen position into a time. */
	enable(col: HTMLElement, day: Date, minutesFromY: (y: number) => number) {
		let blockScroll = false;
		// Must be non-passive so scrolling can be stopped while a range is being selected.
		col.addEventListener("touchmove", (e) => {
			if (blockScroll && e.cancelable) e.preventDefault();
		}, { passive: false });
		col.addEventListener("contextmenu", (e) => {
			if (this.active) e.preventDefault();
		});

		col.addEventListener("pointerdown", (down) => {
			if (down.button !== 0 || !down.isPrimary) return;
			if (this.active || EventModal.openCount > 0) return;
			const touch = down.pointerType === "touch";
			const startX = down.clientX;
			const startY = down.clientY;
			// The pressed 15-minute slot. While dragging, `endAt` is the end of the slot under the pointer,
			// which may be in another day column.
			const anchor = addMinutes(startOfDay(day), minutesFromY(down.clientY));
			let endAt = addMinutes(anchor, SNAP_MIN);
			let moved = false;
			let active = !touch; // touch becomes active after a long press
			let ghosts: HTMLElement[] = [];
			let timer: number | null = null;

			/** The selected range: from the earlier to the later slot, at least one slot long. */
			const range = (): { start: Date; end: Date } => {
				if (!moved) return { start: anchor, end: addMinutes(anchor, this.plugin.settings.defaultEventDuration) };
				const a = Math.min(anchor.getTime(), endAt.getTime() - SNAP_MIN * MS_MIN);
				const b = Math.max(anchor.getTime() + SNAP_MIN * MS_MIN, endAt.getTime());
				return { start: new Date(a), end: new Date(b) };
			};
			/** One selection block per day the range touches (only days shown in this view). */
			const draw = () => {
				ghosts.forEach((g) => g.remove());
				ghosts = [];
				const { start, end } = range();
				for (const c of dayColumns(col)) {
					const dayStart = parseLocal(c.dataset.date ?? "");
					const dayEnd = addDays(dayStart, 1);
					if (end <= dayStart || start >= dayEnd) continue;
					const a = start > dayStart ? start : dayStart;
					const b = end < dayEnd ? end : dayEnd;
					const top = (a.getTime() - dayStart.getTime()) / MS_MIN / 60 * HOUR_HEIGHT;
					const height = (b.getTime() - a.getTime()) / MS_MIN / 60 * HOUR_HEIGHT;
					const g = c.createDiv({ cls: "ch-tg-selection" });
					g.style.setProperty("--ch-event-color", this.newEventColor());
					g.style.top = `${top}px`;
					g.style.height = `${height}px`;
					g.toggleClass("ch-compact", height < 34);
					if (!ghosts.length) {
						// The first block carries the label.
						g.createDiv({ cls: "ch-tg-selection-time", text: this.rangeLabel(start, end) });
						g.createDiv({ cls: "ch-tg-selection-title", text: "New event" });
					} else g.addClass("ch-continued");
					ghosts.push(g);
				}
			};
			const cleanup = () => {
				window.removeEventListener("pointermove", move);
				window.removeEventListener("pointerup", up);
				window.removeEventListener("pointercancel", cancel);
				if (timer !== null) window.clearTimeout(timer);
				timer = null;
				ghosts.forEach((g) => g.remove());
				ghosts = [];
				blockScroll = false;
				col.removeClass("ch-selecting");
				if (this.active === handle) this.active = null;
			};
			const handle = { cancel: cleanup };

			const move = (e: PointerEvent) => {
				if (e.pointerId !== down.pointerId) return;
				if (!active) {
					// Finger moved before the long press: this is a scroll, not a selection.
					if (Math.hypot(e.clientX - startX, e.clientY - startY) > TOUCH_SLOP) cleanup();
					return;
				}
				// The day column under the pointer (the nearest one when it is beside the grid).
				const target = columnAt(col, e.clientX);
				const at = addMinutes(parseLocal(target.dataset.date ?? ""), minutesFromY(e.clientY) + SNAP_MIN);
				if (at.getTime() !== endAt.getTime()) {
					endAt = at;
					moved = true;
					draw();
				}
			};
			const up = (e: PointerEvent) => {
				if (e.pointerId !== down.pointerId) return;
				cleanup();
				if (EventModal.openCount > 0) return;
				const { start, end } = range();
				new EventModal(this.plugin, { start, end }).open();
			};
			const cancel = (e: PointerEvent) => {
				if (e.pointerId === down.pointerId) cleanup();
			};

			this.active = handle;
			window.addEventListener("pointermove", move);
			window.addEventListener("pointerup", up);
			window.addEventListener("pointercancel", cancel);
			if (touch) {
				timer = window.setTimeout(() => {
					timer = null;
					active = true;
					blockScroll = true;
					col.addClass("ch-selecting");
					try {
						navigator.vibrate?.(15);
					} catch {
						/* not supported */
					}
					draw();
				}, LONG_PRESS_MS);
			} else {
				draw();
			}
		});
	}

	/** "12:00 – 13:30", or with weekdays when the range ends on another day: "Mon 12:00 – Tue 06:00". */
	private rangeLabel(start: Date, end: Date): string {
		const use24h = this.plugin.settings.use24h;
		// An end at midnight still belongs to the start day.
		if (isSameDay(start, new Date(end.getTime() - 1))) return formatTimeRange(start, end, use24h);
		const at = (d: Date) => `${formatDate(d, { weekday: "short" })} ${formatTime(d, use24h)}`;
		return `${at(start)} – ${at(end)}`;
	}

	/** Colour of the first calendar new events are saved to, for the selection block. */
	private newEventColor(): string {
		const s = this.plugin.settings;
		const id = s.defaultTargets[0] ?? s.defaultCalendarId;
		return s.sources.find((c) => c.id === id)?.color ?? "var(--interactive-accent)";
	}
}

/** All day columns of the grid this column belongs to (one in the day view, seven in the week view). */
function dayColumns(col: HTMLElement): HTMLElement[] {
	return Array.from(col.parentElement?.querySelectorAll<HTMLElement>(".ch-tg-col") ?? [col]);
}

/** The day column at this horizontal position; beside the grid, the first or last column. */
function columnAt(col: HTMLElement, x: number): HTMLElement {
	const cols = dayColumns(col);
	for (const c of cols) {
		const r = c.getBoundingClientRect();
		if (x >= r.left && x < r.right) return c;
	}
	const first = cols[0].getBoundingClientRect();
	return x < first.left ? cols[0] : cols[cols.length - 1];
}
