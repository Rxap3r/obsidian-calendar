import { normalizePath, Notice, TFile } from "obsidian";
import type OmniCalendarPlugin from "./main";
import { LocalEvent } from "./types";
import { CalendarStore } from "./store";
import { buildIcs } from "./ics";
import { parseLocal, toDateKey } from "./dateUtils";
import { errorMessage } from "./util";

/** The local events as the text of an .ics file. */
export function localEventsToIcs(events: LocalEvent[]): string {
	const items = events.map((ev) => {
		const { start, end } = CalendarStore.bounds(ev);
		let rrule: string | undefined;
		if (ev.recurrence) {
			const r = ev.recurrence;
			rrule = `FREQ=${r.freq.toUpperCase()};INTERVAL=${r.interval || 1}`;
			if (r.count) rrule += `;COUNT=${r.count}`;
			if (r.until) rrule += `;UNTIL=${r.until.replace(/-/g, "")}${ev.allDay ? "" : "T235959Z"}`;
		}
		const exdates = (ev.exdates ?? []).map((d) => {
			const x = parseLocal(d);
			return ev.allDay ? x : new Date(x.getFullYear(), x.getMonth(), x.getDate(), start.getHours(), start.getMinutes());
		});
		return { uid: ev.id, title: ev.title, start, end, allDay: ev.allDay, location: ev.location, description: ev.description, rrule, exdates };
	});
	return buildIcs(items, "Obsidian Omni Calendar");
}

/** Command "Export local events to .ics file": writes the file into the notes folder. */
export async function exportLocalEvents(plugin: OmniCalendarPlugin) {
	const { vault } = plugin.app;
	const events = plugin.data.events;
	const ics = localEventsToIcs(events);
	const folder = plugin.settings.notesFolder || "";
	const path = normalizePath(`${folder ? folder + "/" : ""}omni-calendar-export-${toDateKey(new Date())}.ics`);
	try {
		if (folder && !vault.getAbstractFileByPath(normalizePath(folder))) await vault.createFolder(normalizePath(folder));
		const existing = vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) await vault.modify(existing, ics);
		else await vault.create(path, ics);
		new Notice(`Exported ${events.length} events to ${path}`);
	} catch (e) {
		new Notice(`Export failed: ${errorMessage(e)}`);
	}
}
