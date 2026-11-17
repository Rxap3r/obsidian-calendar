import { Notice } from "obsidian";
import type OmniCalendarPlugin from "../../main";
import { CalendarOccurrence } from "../../types";
import { addMinutes, MS_MIN } from "../../dateUtils";
import { errorMessage } from "../../util";
import { canDrag } from "../shared";
import { minutesAt, SNAP_MIN } from "./layout";
import { columnAt, columnDay, drawRange } from "./ranges";

/**
 * Change how long an event lasts by dragging its top or bottom edge in the week / day grid (like Outlook).
 * The top edge (start) is on the block of the event's first day, the bottom edge (end) on the block of its last day;
 * the end can be dragged into another day. Snaps to 15 minutes; a preview shows the new time while dragging.
 * Same events as drag & drop: local and writable Google / Outlook events, not single repeats of a series.
 */
export function resizeHandles(
	plugin: OmniCalendarPlugin, col: HTMLElement, el: HTMLElement, occ: CalendarOccurrence, at: { dayStart: Date; dayEnd: Date }
) {
	if (!canDrag(occ)) return;
	if (occ.start >= at.dayStart) handle(plugin, col, el, occ, "start");
	if (occ.end <= at.dayEnd) handle(plugin, col, el, occ, "end");
}

/** Clicks right after a resize must not open the event dialog. */
let resizedAt = 0;
export function justResized(): boolean {
	return Date.now() - resizedAt < 400;
}

function handle(plugin: OmniCalendarPlugin, col: HTMLElement, el: HTMLElement, occ: CalendarOccurrence, edge: "start" | "end") {
	const h = el.createDiv({ cls: `ch-tg-resize ch-tg-resize-${edge}`, attr: { "aria-label": edge === "start" ? "Drag to change the start" : "Drag to change the end" } });
	h.addEventListener("pointerdown", (down) => {
		if (down.button !== 0 || !down.isPrimary) return;
		// Not a move (the block is draggable) and not a new event (the column listens too).
		down.stopPropagation();
		down.preventDefault();
		const minLen = SNAP_MIN * MS_MIN;
		let start = occ.start;
		let end = occ.end;
		let blocks: HTMLElement[] = [];
		let changed = false;
		el.draggable = false;
		el.addClass("ch-resizing");
		try {
			h.setPointerCapture(down.pointerId);
		} catch {
			/* not supported */
		}

		const draw = () => {
			blocks.forEach((b) => b.remove());
			blocks = drawRange(col, start, end, { color: occ.color, title: occ.title, use24h: plugin.settings.use24h, cls: "ch-resize-preview" });
		};
		const move = (e: PointerEvent) => {
			if (e.pointerId !== down.pointerId) return;
			const target = columnAt(col, e.clientX);
			const t = addMinutes(columnDay(target), minutesAt(target, e.clientY, Math.round));
			if (edge === "end") {
				const ne = t.getTime() - start.getTime() < minLen ? new Date(start.getTime() + minLen) : t;
				if (ne.getTime() === end.getTime()) return;
				end = ne;
			} else {
				const ns = end.getTime() - t.getTime() < minLen ? new Date(end.getTime() - minLen) : t;
				if (ns.getTime() === start.getTime()) return;
				start = ns;
			}
			changed = start.getTime() !== occ.start.getTime() || end.getTime() !== occ.end.getTime();
			draw();
		};
		const finish = async (e: PointerEvent, save: boolean) => {
			if (e.pointerId !== down.pointerId) return;
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointercancel", cancel);
			blocks.forEach((b) => b.remove());
			el.removeClass("ch-resizing");
			el.draggable = true;
			resizedAt = Date.now();
			if (!save || !changed) return;
			try {
				await plugin.store.moveOccurrence(occ, start, end);
			} catch (err) {
				new Notice(`Could not change the event: ${errorMessage(err)}`, 8000);
			}
		};
		const up = (e: PointerEvent) => void finish(e, true);
		const cancel = (e: PointerEvent) => void finish(e, false);
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", cancel);
		draw();
	});
	// The handle is part of the event block: a plain click on it should not open the dialog after a resize.
	h.addEventListener("click", (e) => {
		if (justResized()) e.stopPropagation();
	});
}
