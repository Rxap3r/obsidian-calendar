import { Menu, setIcon } from "obsidian";
import { deleteEvent } from "../modals/confirmations";
import type OmniCalendarPlugin from "../main";
import { CalendarOccurrence } from "../types";
import { dateLang, formatTime, formatTimeRange, isSameDay, toDateKey } from "../dateUtils";
import { eventKey } from "../eventLinks";
import { eventNotePath } from "../notes";
import { eventNowOf } from "../store";
import { NotePickerModal } from "../modals/NotePickerModal";
import { TaskModal } from "../modals/TaskModal";
import { noteName, openLinkedNote, toggleDone } from "./tasks/helpers";
import { EventModal } from "../modals/EventModal";
import { EventDetailsModal } from "../modals/EventDetailsModal";

export const DRAG_MIME = "application/x-omni-calendar-event";

/** Linked notes listed at most in an event's right-click menu (the dialog shows all). */
const MENU_MAX_NOTES = 5;

/**
 * A click on an event: the details view (default, setting "Clicking opens"), or the edit dialog directly.
 * Read-only events always get the details view.
 */
export function openOccurrence(plugin: OmniCalendarPlugin, occ: CalendarOccurrence) {
	if (plugin.settings.clickOpens === "edit" && !occ.readOnly) editOccurrence(plugin, occ);
	else new EventDetailsModal(plugin, occ).open();
}

/** The edit dialog of an event (local or Google / Outlook); the details view for read-only events. */
export function editOccurrence(plugin: OmniCalendarPlugin, occ: CalendarOccurrence) {
	if (!occ.readOnly && occ.remote) {
		new EventModal(plugin, { remote: occ }).open();
		return;
	}
	if (!occ.readOnly && occ.eventId) {
		const ev = plugin.store.getEvent(occ.eventId);
		if (ev) {
			new EventModal(plugin, { event: ev, occurrenceDate: occ.occurrenceDate }).open();
			return;
		}
	}
	new EventDetailsModal(plugin, occ).open();
}

export function occurrenceMenu(plugin: OmniCalendarPlugin, occ: CalendarOccurrence, evt: MouseEvent) {
	const menu = new Menu();
	// Both are always offered, whatever a click opens (setting "Clicking opens").
	menu.addItem((i) => i.setTitle("Show details").setIcon("info").onClick(() => new EventDetailsModal(plugin, occ).open()));
	if (!occ.readOnly) menu.addItem((i) => i.setTitle("Edit").setIcon("pencil").onClick(() => editOccurrence(plugin, occ)));
	// Linked notes (also for Google / Outlook / ICS events – kept only in Obsidian).
	const links = plugin.store.linksFor(occ);
	for (const path of links.slice(0, MENU_MAX_NOTES)) {
		menu.addItem((i) => i.setTitle(`Open “${noteName(path)}”`).setIcon("file-text").onClick(() => void openLinkedNote(plugin, path)));
	}
	if (!links.includes(eventNotePath(occ, plugin.settings.notesFolder))) {
		menu.addItem((i) => i.setTitle(plugin.hasEventNote(occ) ? "Open note" : "Create note").setIcon("file-plus").onClick(() => void plugin.createNoteForEvent(occ)));
	}
	menu.addItem((i) =>
		i.setTitle("Link note…").setIcon("link").onClick(() =>
			new NotePickerModal(plugin.app, plugin.settings.notesFolder, links, (path) => void plugin.store.addLink(occ, path)).open()
		)
	);
	if (plugin.settings.tasksEnabled && !occ.recurring) {
		const key = eventKey(occ);
		const tracked = plugin.tasks.tracked(key);
		if (tracked) {
			menu.addItem((i) => i.setTitle(tracked.done ? "Mark event as not done" : "Mark event as done").setIcon("check-circle-2").onClick(() => void toggleDone(plugin, tracked)));
		}
		menu.addItem((i) =>
			i.setTitle(tracked ? "Stop tracking as task" : "Track as task").setIcon("list-checks").onClick(() =>
				void plugin.tasks.setTracked(key, eventNowOf(occ.title, occ.start, occ.end, occ.allDay), !tracked)
			)
		);
	}
	if (plugin.settings.tasksEnabled) {
		menu.addItem((i) =>
			i.setTitle("Add task…").setIcon("check-square").onClick(() => {
				const date = toDateKey(occ.start);
				new TaskModal(plugin, undefined, { date, event: { key: eventKey(occ), title: occ.title, date } }).open();
			})
		);
	}
	if (!occ.readOnly && occ.eventId) {
		const id = occ.eventId;
		menu.addSeparator();
		menu.addItem((i) =>
			i.setTitle("Duplicate").setIcon("copy").onClick(async () => {
				const ev = plugin.store.getEvent(id);
				if (!ev) return;
				// The copy starts without linked notes and tasks.
				const { id: _id, created: _c, updated: _u, links: _l, ...rest } = ev;
				void _id; void _c; void _u; void _l;
				await plugin.store.addEvent({ ...rest, title: `${ev.title} (copy)` });
			})
		);
		if (occ.recurring && occ.occurrenceDate) {
			menu.addItem((i) =>
				i.setTitle("Delete this occurrence").setIcon("calendar-x").onClick(() => void deleteEvent(plugin, occ, false))
			);
		}
		menu.addItem((i) =>
			i.setTitle(occ.recurring ? "Delete all occurrences" : "Delete").setIcon("trash").setWarning(true).onClick(() => void deleteEvent(plugin, occ, true))
		);
	}
	if (!occ.readOnly && occ.remote) {
		const del = (series: boolean) => void deleteEvent(plugin, occ, series);
		menu.addSeparator();
		if (occ.recurring) menu.addItem((i) => i.setTitle("Delete this occurrence").setIcon("calendar-x").onClick(() => del(false)));
		menu.addItem((i) => i.setTitle(occ.recurring ? "Delete series" : "Delete").setIcon("trash").setWarning(true).onClick(() => del(occ.recurring)));
	}
	menu.showAtMouseEvent(evt);
}

/** Mark a day cell of a month grid: today, weekend, and days that belong to the neighbouring month. */
export function markDayCell(cell: HTMLElement, day: Date, month: Date) {
	if (day.getMonth() !== month.getMonth()) cell.addClass("ch-other-month");
	if (isSameDay(day, new Date())) cell.addClass("ch-today");
	if (day.getDay() === 0 || day.getDay() === 6) cell.addClass("ch-weekend");
}

/** Build a compact event "chip" used in month cells, all-day rows, sidebar lists. */
export function createChip(
	plugin: OmniCalendarPlugin,
	parent: HTMLElement,
	occ: CalendarOccurrence,
	/** showTime: start time; with `day` it shows the range ("10:00–11:30") for that day; `span`: the whole span of a multi-day event. */
	opts: { showTime?: boolean; draggable?: boolean; day?: Date; span?: boolean } = {}
): HTMLElement {
	const chip = parent.createDiv({ cls: "ch-chip" });
	chip.style.setProperty("--ch-event-color", occ.color);
	if (occ.allDay) chip.addClass("ch-chip-allday");
	if (occ.readOnly) chip.addClass("ch-readonly");
	if (occ.end < new Date()) chip.addClass("ch-past");
	if (!occ.allDay) chip.createSpan({ cls: "ch-chip-dot" });
	const span = opts.span && spansDays(occ);
	if (span) chip.addClass("ch-chip-multiday");
	if (opts.showTime && !occ.allDay && !span) {
		chip.createSpan({ cls: "ch-chip-time", text: opts.day ? timeRangeForDay(occ, opts.day, plugin.settings.use24h) : formatTime(occ.start, plugin.settings.use24h) });
	}
	chip.createSpan({ cls: "ch-chip-title", text: occ.title });
	taskHint(plugin, chip, occ);
	trackedMark(plugin, chip, occ);
	// Multi-day event in the all-day row: its whole span on a second line, so it never reads like "09:00–10:00" each day.
	if (span) chip.createSpan({ cls: "ch-chip-span", text: spanLabel(occ, plugin.settings.use24h) });
	chip.setAttr("title", tooltip(plugin, occ));
	chip.addEventListener("click", (e) => {
		e.stopPropagation();
		openOccurrence(plugin, occ);
	});
	chip.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
		occurrenceMenu(plugin, occ, e);
	});
	chip.addEventListener("pointerdown", (e) => e.stopPropagation());
	if (opts.draggable && canDrag(occ)) {
		chip.draggable = true;
		chip.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData(DRAG_MIME, occ.key);
			e.dataTransfer?.setData("text/plain", occ.title);
			chip.addClass("ch-dragging");
		});
		chip.addEventListener("dragend", () => chip.removeClass("ch-dragging"));
	}
	return chip;
}

export function tooltip(plugin: OmniCalendarPlugin, occ: CalendarOccurrence): string {
	const src = plugin.store.getSource(occ.sourceId);
	const time = occ.allDay ? "All day" : formatTimeRange(occ.start, occ.end, plugin.settings.use24h);
	const tasks = plugin.settings.tasksEnabled ? plugin.tasks.forEvent(eventKey(occ)) : [];
	const progress = tasks.length ? `Tasks: ${tasks.filter((t) => t.done).length}/${tasks.length} done` : "";
	return [occ.title, time, occ.location, src?.name, progress].filter(Boolean).join("\n");
}

/**
 * "Track as task": a tick circle at the start of `el` (an event chip, block or row) to mark the event as done; a done
 * event gets the class `ch-event-done` (struck through). Nothing happens for events that aren't tracked.
 */
export function trackedMark(plugin: OmniCalendarPlugin, el: HTMLElement, occ: CalendarOccurrence, into: HTMLElement = el) {
	if (!plugin.settings.tasksEnabled || occ.recurring) return;
	const t = plugin.tasks.tracked(eventKey(occ));
	if (!t) return;
	el.toggleClass("ch-event-done", t.done);
	const cb = into.createEl("button", {
		cls: "ch-task-checkbox ch-small ch-track-check",
		attr: { role: "checkbox", "aria-checked": String(t.done), "aria-label": t.done ? "Mark event as not done" : "Mark event as done" },
	});
	if (t.done) setIcon(cb, "check");
	cb.addEventListener("pointerdown", (e) => e.stopPropagation());
	cb.addEventListener("click", (e) => {
		e.stopPropagation();
		void toggleDone(plugin, t);
	});
	into.prepend(cb);
}

/** The small "☑ 2/5" progress of an event's tasks (nothing when it has none, or tasks are off). */
export function taskHint(plugin: OmniCalendarPlugin, parent: HTMLElement, occ: CalendarOccurrence): HTMLElement | null {
	if (!plugin.settings.tasksEnabled) return null;
	const tasks = plugin.tasks.forEvent(eventKey(occ));
	if (!tasks.length) return null;
	const done = tasks.filter((t) => t.done).length;
	const el = parent.createSpan({ cls: "ch-task-hint", attr: { "aria-label": `${done} of ${tasks.length} tasks done` } });
	el.toggleClass("is-complete", done === tasks.length);
	setIcon(el.createSpan({ cls: "ch-task-hint-icon" }), done === tasks.length ? "check-square" : "square");
	el.appendText(`${done}/${tasks.length}`);
	return el;
}

/** Local or writable remote events that are not part of a recurring series can be dragged. */
export function canDrag(occ: CalendarOccurrence): boolean {
	return !occ.readOnly && !occ.recurring && (!!occ.eventId || !!occ.remote);
}

/** The whole span of a timed event over several days, with weekdays: "Mon 09:00 – Tue 10:00". */
export function spanLabel(occ: CalendarOccurrence, use24h: boolean): string {
	const at = (d: Date) => `${d.toLocaleDateString(dateLang(), { weekday: "short" })} ${formatTime(d, use24h)}`;
	return `${at(occ.start)} – ${at(occ.end)}`;
}

/** A timed event whose end falls on a later day than its start (an end at midnight belongs to the day before). */
export function spansDays(occ: CalendarOccurrence): boolean {
	return !occ.allDay && !isSameDay(occ.start, new Date(occ.end.getTime() - 1));
}

/**
 * Time label of a timed event on one day of the month view:
 * "10:00–11:30" (same day), "22:00 →" (first day of a multi-day event), "→ 02:00" (last day),
 * "→" (a day in between).
 */
export function timeRangeForDay(occ: CalendarOccurrence, day: Date, use24h: boolean): string {
	const startsToday = isSameDay(occ.start, day);
	// An end at exactly midnight belongs to the day before.
	const lastDay = new Date(occ.end.getTime() - 1);
	const endsToday = isSameDay(lastDay, day);
	const s = formatTime(occ.start, use24h);
	const e = formatTime(occ.end, use24h);
	if (startsToday && endsToday) return occ.end.getTime() === occ.start.getTime() ? s : `${s}–${e}`;
	if (startsToday) return `${s} →`;
	if (endsToday) return `→ ${e}`;
	return "→";
}
