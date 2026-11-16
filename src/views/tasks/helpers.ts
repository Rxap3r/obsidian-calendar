import { Notice, TFile } from "obsidian";
import type OmniCalendarPlugin from "../../main";
import { Task } from "../../types";

/** Open a linked note in the main area (in a new tab). */
export async function openLinkedNote(plugin: OmniCalendarPlugin, path: string) {
	const file = plugin.app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) {
		new Notice("This note doesn't exist any more.");
		return;
	}
	await plugin.mainAreaLeaf().openFile(file);
}

/** "10:30–11:00", "10:30" or "". */
export function taskTimeLabel(t: Task): string {
	if (!t.start) return "";
	return t.end ? `${t.start}–${t.end}` : t.start;
}

/** "Meeting notes" for "Work/Meeting notes.md". */
export function noteName(path: string): string {
	return path.replace(/\.md$/, "").split("/").pop() ?? path;
}
