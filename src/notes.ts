import { App, normalizePath, Notice, TFile } from "obsidian";
import { CalendarOccurrence, Subtask, Task } from "./types";
import { dateLang, formatTime, formatTimeKey, toDateKey, toTimeKey } from "./dateUtils";
import { PRIORITY_NAMES } from "./tasks";
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

/** Default template of "Create note" on tasks and subtasks. */
export const DEFAULT_TASK_NOTE_TEMPLATE = `---
title: "{{title}}"
date: {{date}}
list: "{{list}}"
tags: [task]
---

# {{title}}

{{notes}}

## Notes

`;

function sanitizeFileName(s: string, fallback = "Event"): string {
	return s.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || fallback;
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

function inFolder(folderSetting: string, name: string): string {
	const folder = normalizePath(folderSetting || "/");
	return normalizePath(folder === "/" ? name : `${folder}/${name}`);
}

/** The name of a task's (or subtask's) note: "Fix the bike", "Fix the bike – Buy chain". */
export function taskNoteTitle(t: Task, sub?: Subtask): string {
	return sub ? `${t.title} – ${sub.title}` : t.title;
}

/** Where "Create note" puts the note of a task or subtask: "<folder>/YYYY-MM-DD Title.md" ("Title.md" without a date). */
export function taskNotePath(t: Task, sub: Subtask | undefined, folderSetting: string): string {
	const name = sanitizeFileName(taskNoteTitle(t, sub), "Task");
	return inFolder(folderSetting, `${t.date ? `${t.date} ` : ""}${name}.md`);
}

/** Create the folder of a new note if it's missing. */
async function ensureFolder(app: App, folderSetting: string) {
	const folder = normalizePath(folderSetting || "/");
	if (folder !== "/" && !app.vault.getAbstractFileByPath(folder)) {
		try {
			await app.vault.createFolder(folder);
		} catch {
			/* may already exist */
		}
	}
}

/** Create (or find, if it exists) the note of a task or one of its subtasks. Returns the file. */
export async function createTaskNote(
	app: App,
	t: Task,
	sub: Subtask | undefined,
	opts: { folder: string; template: string; listName: string; use24h: boolean }
): Promise<TFile | null> {
	const path = taskNotePath(t, sub, opts.folder);
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return existing;
	await ensureFolder(app, opts.folder);
	const time = t.start ? `${formatTimeKey(t.start, opts.use24h)}${t.end ? `–${formatTimeKey(t.end, opts.use24h)}` : ""}` : "";
	const vars: Record<string, string> = {
		title: yamlSafe(taskNoteTitle(t, sub)),
		task: yamlSafe(t.title),
		subtask: yamlSafe(sub?.title ?? ""),
		date: t.date ?? "",
		time,
		list: yamlSafe(opts.listName),
		priority: PRIORITY_NAMES[t.priority],
		notes: (sub ? sub.description : t.notes) ?? "",
	};
	const body = (opts.template || DEFAULT_TASK_NOTE_TEMPLATE).replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
	try {
		return await app.vault.create(path, body);
	} catch (e) {
		new Notice(`Omni Calendar: could not create note (${errorMessage(e)})`);
		return null;
	}
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
