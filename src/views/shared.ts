import { Menu, Notice } from "obsidian";
import { confirmAction } from "../modals/ConfirmModal";
import type OmniCalendarPlugin from "../main";
import { CalendarOccurrence } from "../types";
import { formatTime } from "../dateUtils";
import { EventModal } from "../modals/EventModal";
import { EventDetailsModal } from "../modals/EventDetailsModal";

export const DRAG_MIME = "application/x-omni-calendar-event";

/** Open the editor for local events or the details view for external events. */
export function openOccurrence(plugin: OmniCalendarPlugin, occ: CalendarOccurrence) {
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
	menu.addItem((i) => i.setTitle(occ.readOnly ? "Show details" : "Edit").setIcon(occ.readOnly ? "info" : "pencil").onClick(() => openOccurrence(plugin, occ)));
	menu.addItem((i) =>
		i.setTitle(occ.notePath ? "Open note" : "Create note").setIcon("file-plus").onClick(() => {
			if (occ.eventId) {
				const ev = plugin.store.getEvent(occ.eventId);
				if (ev) void plugin.openNoteForLocalEvent(ev, occ.occurrenceDate);
			} else {
				void plugin.openNoteForOccurrence(occ);
			}
		})
	);
	if (!occ.readOnly && occ.eventId) {
		const id = occ.eventId;
		menu.addSeparator();
		menu.addItem((i) =>
			i.setTitle("Duplicate").setIcon("copy").onClick(async () => {
				const ev = plugin.store.getEvent(id);
				if (!ev) return;
				const { id: _id, created: _c, updated: _u, notePath: _n, ...rest } = ev;
				void _id; void _c; void _u; void _n;
				await plugin.store.addEvent({ ...rest, title: `${ev.title} (copy)` });
			})
		);
		if (occ.recurring && occ.occurrenceDate) {
			menu.addItem((i) =>
				i.setTitle("Delete this occurrence").setIcon("calendar-x").onClick(() => plugin.store.excludeOccurrence(id, occ.occurrenceDate as string))
			);
		}
		menu.addItem((i) =>
			i.setTitle(occ.recurring ? "Delete all occurrences" : "Delete").setIcon("trash").setWarning(true).onClick(() => plugin.store.deleteEvent(id))
		);
	}
	if (!occ.readOnly && occ.remote) {
		const where = plugin.store.getSource(occ.sourceId)?.type === "google" ? "Google Calendar" : "Outlook";
		const del = async (series: boolean) => {
			const what = series ? "all occurrences of this event" : occ.recurring ? "this occurrence" : "this event";
			if (!(await confirmAction(plugin.app, "Delete event?", `"${occ.title}" – ${what} will be permanently deleted from ${where}.`))) return;
			try {
				await plugin.store.deleteRemote(occ, series);
				new Notice(`Deleted "${occ.title}" from ${where}`);
			} catch (e) {
				new Notice(`Could not delete: ${e instanceof Error ? e.message : String(e)}`, 8000);
			}
		};
		menu.addSeparator();
		if (occ.recurring) menu.addItem((i) => i.setTitle("Delete this occurrence").setIcon("calendar-x").onClick(() => void del(false)));
		menu.addItem((i) => i.setTitle(occ.recurring ? "Delete series" : "Delete").setIcon("trash").setWarning(true).onClick(() => void del(occ.recurring)));
	}
	menu.showAtMouseEvent(evt);
}

/** Build a compact event "chip" used in month cells, all-day rows, sidebar lists. */
export function createChip(
	plugin: OmniCalendarPlugin,
	parent: HTMLElement,
	occ: CalendarOccurrence,
	opts: { showTime?: boolean; draggable?: boolean } = {}
): HTMLElement {
	const chip = parent.createDiv({ cls: "ch-chip" });
	chip.style.setProperty("--ch-event-color", occ.color);
	if (occ.allDay) chip.addClass("ch-chip-allday");
	if (occ.readOnly) chip.addClass("ch-readonly");
	if (occ.end < new Date()) chip.addClass("ch-past");
	if (!occ.allDay) chip.createSpan({ cls: "ch-chip-dot" });
	if (opts.showTime && !occ.allDay) {
		chip.createSpan({ cls: "ch-chip-time", text: formatTime(occ.start, plugin.settings.use24h) });
	}
	chip.createSpan({ cls: "ch-chip-title", text: occ.title });
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
	const time = occ.allDay
		? "All day"
		: `${formatTime(occ.start, plugin.settings.use24h)} – ${formatTime(occ.end, plugin.settings.use24h)}`;
	return [occ.title, time, occ.location, src?.name].filter(Boolean).join("\n");
}

/** Local or writable remote events that are not part of a recurring series can be dragged. */
export function canDrag(occ: CalendarOccurrence): boolean {
	return !occ.readOnly && !occ.recurring && (!!occ.eventId || !!occ.remote);
}
