import { Notice, setIcon, TFile } from "obsidian";
import { chooseAction } from "../../modals/ConfirmModal";
import { plural } from "../../util";
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

/** Linked notes as small chips that open the note (task lists, details view). Nothing when there are none. */
export function noteChips(plugin: OmniCalendarPlugin, container: HTMLElement, links: string[], cls = ""): void {
	if (!links.length) return;
	const wrap = container.createDiv({ cls: `ch-task-linkchips ${cls}`.trim() });
	for (const path of links) {
		const chip = wrap.createEl("a", { cls: "ch-task-linkchip", attr: { title: path } });
		setIcon(chip.createSpan({ cls: "ch-task-meta-icon" }), "file-text");
		chip.appendText(noteName(path));
		chip.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			void openLinkedNote(plugin, path);
		};
	}
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

/**
 * Tick a task off (or on again). Ticking off a tracked event ("Track as task") whose event still has open tasks asks
 * whether to mark those as done too. Used everywhere a task can be ticked off, so all places behave the same.
 */
export async function toggleDone(plugin: OmniCalendarPlugin, t: Task) {
	const store = plugin.tasks;
	if (!t.done && t.event?.self && plugin.settings.tasksOnEvents) {
		const open = store.forEvent(t.event.key).filter((x) => !x.done);
		if (open.length) {
			const answer = await chooseAction(
				plugin.app, "Event done",
				`“${t.title}” still has ${plural(open.length, "open task")}. Mark ${open.length === 1 ? "it" : "them"} as done too?`,
				[
					{ label: "Only the event", value: "event" },
					{ label: open.length === 1 ? "Mark the task as done too" : "Mark all as done", value: "all" },
				]
			);
			if (!answer) return;
			await store.setDoneMany([t.id, ...(answer === "all" ? open.map((x) => x.id) : [])], true);
			return;
		}
	}
	await store.setDone(t.id, !t.done);
}
