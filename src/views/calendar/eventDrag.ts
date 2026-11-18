import { Notice } from "obsidian";
import type OmniCalendarPlugin from "../../main";
import { CalendarOccurrence, Task } from "../../types";
import {
	addDays, addMinutes, dayDiff, formatTimeRange, minutesToTimeKey, MS_MIN, startOfDay, timeKeyToMinutes, toDateKey,
} from "../../dateUtils";
import { errorMessage } from "../../util";
import { canDrag, DRAG_MIME } from "../shared";
import { TASK_MIME } from "./tasks";
import { HOUR_HEIGHT, minutesAt } from "./layout";

/** Transparent 1×1 image used to hide the browser's drag picture (the drop preview replaces it). */
const EMPTY_DRAG_IMAGE = new Image();
EMPTY_DRAG_IMAGE.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

/** Moving events with the mouse: where they can be dropped, and the preview of where they will land. */
export class EventDrag {
	/** Occurrences currently on screen, by key. */
	private rendered = new Map<string, CalendarOccurrence>();
	/**
	 * The event being dragged in the week / day grid: where it was grabbed (minutes after its start) and
	 * its length, so the drop lands exactly where the preview shows it.
	 */
	private grabbed: { key: string; offsetMin: number; durMin: number; color: string; title: string } | null = null;
	private preview: HTMLElement | null = null;

	constructor(private plugin: OmniCalendarPlugin) {}

	/** The occurrences that were just drawn (a drop looks the dragged event up here). */
	remember(occs: CalendarOccurrence[]) {
		this.rendered = new Map(occs.map((o) => [o.key, o]));
	}

	/**
	 * Accept dropped events and tasks on a day (month cell / all-day row), or on a time column when
	 * `timeFromEvent` gives the start time in minutes. A task dropped on the all-day row
	 * (`clearTaskTime`) loses its time; on a month cell it keeps it.
	 */
	dropTarget(el: HTMLElement, day: Date, timeFromEvent: ((e: DragEvent) => number) | null = null, opts: { clearTaskTime?: boolean } = {}) {
		el.addEventListener("dragover", (e) => {
			if (!isOurDrag(e)) return;
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
			el.addClass("ch-drop-target");
		});
		el.addEventListener("dragleave", () => el.removeClass("ch-drop-target"));
		el.addEventListener("drop", async (e) => {
			el.removeClass("ch-drop-target");
			const taskId = e.dataTransfer?.getData(TASK_MIME);
			if (taskId) {
				e.preventDefault();
				const minutes = timeFromEvent ? timeFromEvent(e) : null;
				this.clearPreview();
				await this.moveTask(taskId, day, minutes, !!opts.clearTaskTime);
				return;
			}
			const key = e.dataTransfer?.getData(DRAG_MIME);
			if (!key) return;
			e.preventDefault();
			const occ = this.rendered.get(key);
			if (!occ) return;
			const dur = occ.end.getTime() - occ.start.getTime();
			let ns: Date;
			if (occ.allDay) {
				ns = addDays(occ.start, dayDiff(occ.start, day));
			} else if (timeFromEvent) {
				ns = addMinutes(startOfDay(day), timeFromEvent(e));
				this.clearPreview();
			} else {
				ns = new Date(day.getFullYear(), day.getMonth(), day.getDate(), occ.start.getHours(), occ.start.getMinutes());
			}
			if (ns.getTime() === occ.start.getTime()) return;
			const ne = occ.allDay ? addDays(ns, dayDiff(occ.start, occ.end)) : new Date(ns.getTime() + dur);
			try {
				await this.plugin.store.moveOccurrence(occ, ns, ne);
			} catch (err) {
				new Notice(`Could not move event: ${errorMessage(err)}`, 8000);
			}
		});
	}

	/** A day column of the week / day grid: events can be dropped on a time, with a preview while dragging. */
	timeColumn(col: HTMLElement, day: Date) {
		// The event's top edge goes where the preview shows it (grab point taken into account),
		// rounded to the nearest 15 minutes.
		const dropStart = (clientY: number) => minutesAt(col, clientY, Math.round, this.grabbed?.offsetMin ?? 0);
		this.dropTarget(col, day, (e) => dropStart(e.clientY));
		col.addEventListener("dragover", (e) => {
			if (!this.grabbed || !isOurDrag(e)) return;
			this.showPreview(col, day, dropStart(e.clientY));
		});
	}

	/**
	 * Make an event block of the week / day grid draggable (if it may be moved).
	 * `segStart` is where the block starts on this day (later than the event's start if it began the day before).
	 */
	grabbable(el: HTMLElement, occ: CalendarOccurrence, segStart: Date) {
		if (!canDrag(occ) || this.plugin.lock.locked) return;
		el.draggable = true;
		el.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData(DRAG_MIME, occ.key);
			el.addClass("ch-dragging");
			// Where in the event it was grabbed (also for events that started on an earlier day).
			const r = el.getBoundingClientRect();
			const offsetMin = ((e.clientY - r.top) / HOUR_HEIGHT) * 60 + (segStart.getTime() - occ.start.getTime()) / MS_MIN;
			this.grabbed = { key: occ.key, offsetMin, durMin: (occ.end.getTime() - occ.start.getTime()) / MS_MIN, color: occ.color, title: occ.title };
			// Hide the browser's drag picture: the snapping preview shows the real result instead.
			if (e.dataTransfer && EMPTY_DRAG_IMAGE.complete) e.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0);
		});
		el.addEventListener("dragend", () => {
			el.removeClass("ch-dragging");
			this.grabbed = null;
			this.clearPreview();
		});
	}

	/** Make a task block of the week / day grid draggable to another time or day. */
	grabbableTask(el: HTMLElement, t: Task, slot: { start: Date; end: Date }) {
		if (this.plugin.lock.locked) return;
		el.draggable = true;
		el.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData(TASK_MIME, t.id);
			e.dataTransfer?.setData("text/plain", t.title);
			el.addClass("ch-dragging");
			const r = el.getBoundingClientRect();
			const offsetMin = ((e.clientY - r.top) / HOUR_HEIGHT) * 60;
			const color = this.plugin.tasks.list(t.listId).color;
			this.grabbed = { key: `task:${t.id}`, offsetMin, durMin: (slot.end.getTime() - slot.start.getTime()) / MS_MIN, color, title: t.title };
			if (e.dataTransfer && EMPTY_DRAG_IMAGE.complete) e.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0);
		});
		el.addEventListener("dragend", () => {
			el.removeClass("ch-dragging");
			this.grabbed = null;
			this.clearPreview();
		});
	}

	/**
	 * A task was dropped on a day: on a time (`minutes`) it gets that time and keeps its length; on the
	 * all-day row (`clearTime`) it keeps only the date; on a month cell it keeps its time.
	 */
	async moveTask(id: string, day: Date, minutes: number | null, clearTime: boolean) {
		const t = this.plugin.tasks.get(id);
		if (!t) return;
		const date = toDateKey(day);
		let { start, end } = t;
		if (minutes !== null) {
			const length = t.start && t.end ? timeKeyToMinutes(t.end) - timeKeyToMinutes(t.start) : 0;
			start = minutesToTimeKey(minutes);
			// The end stays on the same day; a range that would pass midnight keeps only its start.
			end = length > 0 && minutes + length < 24 * 60 ? minutesToTimeKey(minutes + length) : undefined;
		} else if (clearTime) {
			start = end = undefined;
		}
		if (date === t.date && start === t.start && end === t.end) return;
		await this.plugin.tasks.update(id, { date, start, end });
	}

	/** The block that shows where (and when) a dragged event will land. */
	private showPreview(col: HTMLElement, day: Date, startMin: number) {
		const info = this.grabbed;
		if (!info) return;
		let p = this.preview;
		if (!p || p.parentElement !== col) {
			p?.remove();
			p = this.preview = col.createDiv({ cls: "ch-tg-selection ch-drop-preview" });
			p.createDiv({ cls: "ch-tg-selection-time" });
			p.createDiv({ cls: "ch-tg-selection-title", text: info.title });
			p.style.setProperty("--ch-event-color", info.color);
		}
		const endMin = startMin + info.durMin;
		const shownEnd = Math.min(endMin, 24 * 60);
		p.style.top = `${(startMin / 60) * HOUR_HEIGHT}px`;
		p.style.height = `${Math.max(((shownEnd - startMin) / 60) * HOUR_HEIGHT, 18) - 2}px`;
		p.toggleClass("ch-compact", ((shownEnd - startMin) / 60) * HOUR_HEIGHT < 34);
		const base = startOfDay(day);
		(p.firstChild as HTMLElement).setText(formatTimeRange(addMinutes(base, startMin), addMinutes(base, endMin), this.plugin.settings.use24h));
	}

	private clearPreview() {
		this.preview?.remove();
		this.preview = null;
	}
}

/** An event or a task of ours is being dragged. */
function isOurDrag(e: DragEvent): boolean {
	const types = e.dataTransfer?.types ?? [];
	return types.includes(DRAG_MIME) || types.includes(TASK_MIME);
}
