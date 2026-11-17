import { App, normalizePath, Notice, TFile } from "obsidian";
import { CalendarOccurrence } from "./types";
import { dateLang, formatTime, toDateKey, toTimeKey } from "./dateUtils";
import { errorMessage } from "./util";

export const DEFAULT_NOTE_TEMPLATE = `---
title: "{{title}}"
date: {{date}}
start: {{start}}
end: {{end}}
calendar: "{{calendar}}"
location: "{{location}}"
tags: [event]
---

# {{title}}

**When:** {{when}}
**Where:** {{location}}

{{description}}

## Notes

`;

function sanitizeFileName(s: string): string {
	return s.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "Event";
}

function yamlSafe(s: string): string {
	return s.replace(/"/g, '\\"').replace(/\r?\n/g, " ");
}

export function describeWhen(o: CalendarOccurrence, use24h: boolean): string {
	const dateOpts: Intl.DateTimeFormatOptions = { weekday: "short", year: "numeric", month: "short", day: "numeric" };
	if (o.allDay) {
		const last = new Date(o.end.getTime() - 1);
		const a = o.start.toLocaleDateString(dateLang(), dateOpts);
		if (toDateKey(last) === toDateKey(o.start)) return `${a} (all day)`;
		return `${a} – ${last.toLocaleDateString(dateLang(), dateOpts)} (all day)`;
	}
	const a = `${o.start.toLocaleDateString(dateLang(), dateOpts)} ${formatTime(o.start, use24h)}`;
	if (toDateKey(o.start) === toDateKey(o.end)) return `${a} – ${formatTime(o.end, use24h)}`;
	return `${a} – ${o.end.toLocaleDateString(dateLang(), dateOpts)} ${formatTime(o.end, use24h)}`;
}

/** Where "Create note" puts the note of an event occurrence: "<folder>/YYYY-MM-DD Title.md". */
export function eventNotePath(o: CalendarOccurrence, folderSetting: string): string {
	const folder = normalizePath(folderSetting || "/");
	const name = `${toDateKey(o.start)} ${sanitizeFileName(o.title)}.md`;
	return normalizePath(folder === "/" ? name : `${folder}/${name}`);
}

/** Create (or open, if it exists) a note for an event occurrence. Returns the file. */
export async function createEventNote(
	app: App,
	o: CalendarOccurrence,
	opts: { folder: string; template: string; calendarName: string; use24h: boolean }
): Promise<TFile | null> {
	const folder = normalizePath(opts.folder || "/");
	const path = eventNotePath(o, opts.folder);

	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return existing;

	if (folder !== "/" && !app.vault.getAbstractFileByPath(folder)) {
		try {
			await app.vault.createFolder(folder);
		} catch {
			/* may already exist */
		}
	}
	const vars: Record<string, string> = {
		title: yamlSafe(o.title),
		date: toDateKey(o.start),
		start: o.allDay ? toDateKey(o.start) : `${toDateKey(o.start)}T${toTimeKey(o.start)}`,
		end: o.allDay ? toDateKey(new Date(o.end.getTime() - 1)) : `${toDateKey(o.end)}T${toTimeKey(o.end)}`,
		calendar: yamlSafe(opts.calendarName),
		location: yamlSafe(o.location ?? ""),
		description: o.description ?? "",
		when: describeWhen(o, opts.use24h),
	};
	const body = (opts.template || DEFAULT_NOTE_TEMPLATE).replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
	try {
		return await app.vault.create(path, body);
	} catch (e) {
		new Notice(`Omni Calendar: could not create note (${errorMessage(e)})`);
		return null;
	}
}
