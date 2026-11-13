import { App, normalizePath, Notice, TFile } from "obsidian";
import { CalendarOccurrence } from "./types";
import { formatTime, toDateKey, toTimeKey } from "./dateUtils";

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
		const a = o.start.toLocaleDateString(undefined, dateOpts);
		if (toDateKey(last) === toDateKey(o.start)) return `${a} (all day)`;
		return `${a} – ${last.toLocaleDateString(undefined, dateOpts)} (all day)`;
	}
	const a = `${o.start.toLocaleDateString(undefined, dateOpts)} ${formatTime(o.start, use24h)}`;
	if (toDateKey(o.start) === toDateKey(o.end)) return `${a} – ${formatTime(o.end, use24h)}`;
	return `${a} – ${o.end.toLocaleDateString(undefined, dateOpts)} ${formatTime(o.end, use24h)}`;
}

/** Create (or open, if it exists) a note for an event occurrence. Returns the file. */
export async function createEventNote(
	app: App,
	o: CalendarOccurrence,
	opts: { folder: string; template: string; calendarName: string; use24h: boolean }
): Promise<TFile | null> {
	const folder = normalizePath(opts.folder || "/");
	const name = `${toDateKey(o.start)} ${sanitizeFileName(o.title)}.md`;
	const path = normalizePath(folder === "/" ? name : `${folder}/${name}`);

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
		new Notice(`Calendar Hub: could not create note (${e instanceof Error ? e.message : e})`);
		return null;
	}
}
