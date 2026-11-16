import { Notice, TFile } from "obsidian";
import { chooseAction } from "../../modals/ConfirmModal";
import type OmniCalendarPlugin from "../../main";
import { CalendarOccurrence, Task } from "../../types";

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

/**
 * Open the event a task belongs to (edit dialog or details). If the event is gone, offer to delete the task
 * or keep it without the event.
 */
export async function openTaskEvent(plugin: OmniCalendarPlugin, t: Task, open: (occ: CalendarOccurrence) => void) {
	if (!t.event) return;
	const occ = plugin.store.findOccurrence(t.event.key, t.event.date);
	if (occ) {
		open(occ);
		return;
	}
	const why = plugin.tasks.eventGone(t)
		? "was deleted"
		: "can't be found (it was deleted, or its calendar is hidden or not loaded on this device)";
	const answer = await chooseAction(plugin.app, "Event not found", `The event “${t.event.title}” ${why}. What should happen to the task “${t.title}”?`, [
		{ label: "Keep task without event", value: "keep" },
		{ label: "Delete task", value: "delete", warning: true },
	]);
	if (answer === "delete") await plugin.tasks.remove(t.id);
	else if (answer === "keep") await plugin.tasks.update(t.id, { event: undefined });
}
