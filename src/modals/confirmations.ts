import { Notice } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { CalendarOccurrence, TaskList } from "../types";
import { DEFAULT_TASK_LIST } from "../tasks";
import { errorMessage, plural } from "../util";
import { confirmAction } from "./ConfirmModal";

/**
 * Delete an event – one occurrence, or (`series`) the whole event / every repeat – together with its tasks.
 * Google / Outlook deletes always ask; local ones ask only when tasks would be deleted too.
 * Linked notes are only unlinked. Returns true when the event was deleted.
 */
export async function deleteEvent(plugin: OmniCalendarPlugin, occ: CalendarOccurrence, series: boolean): Promise<boolean> {
	const store = plugin.store;
	const match = store.keysForDelete(occ, series);
	const n = plugin.tasks.forEvents(match).filter((t) => !t.event?.self).length;
	const tasks = n ? ` ${n === 1 ? "Its task" : `Its ${plural(n, "task")}`} will be deleted too.` : "";
	const what = series && occ.recurring ? "all occurrences of this event" : occ.recurring ? "this occurrence" : "this event";
	try {
		if (occ.remote) {
			const where = store.serviceName(occ.sourceId);
			if (!(await confirmAction(plugin.app, "Delete event?", `"${occ.title}" – ${what} will be permanently deleted from ${where}.${tasks}`))) return false;
			await store.deleteRemote(occ, series);
			new Notice(`Deleted "${occ.title}" from ${where}`);
		} else if (occ.eventId) {
			if (n && !(await confirmAction(plugin.app, "Delete event?", `Delete "${occ.title}" (${what})?${tasks}`))) return false;
			if (occ.recurring && !series && occ.occurrenceDate) await store.excludeOccurrence(occ.eventId, occ.occurrenceDate);
			else await store.deleteEvent(occ.eventId);
			new Notice(`Deleted "${occ.title}"`);
		} else return false;
	} catch (e) {
		new Notice(`Could not delete: ${errorMessage(e)}`, 8000);
		return false;
	}
	await plugin.tasks.removeForEvents(match);
	await store.dropLinks(match);
	return true;
}

/** Delete a task list after asking; its tasks move to the default list. Returns true when it was deleted. */
export async function deleteTaskList(plugin: OmniCalendarPlugin, list: TaskList): Promise<boolean> {
	const n = plugin.tasks.items.filter((t) => t.listId === list.id).length;
	const msg = n ? `Delete “${list.name}”? Its ${plural(n, "task")} will move to “${DEFAULT_TASK_LIST.name}”.` : `Delete “${list.name}”?`;
	if (!(await confirmAction(plugin.app, "Delete list", msg))) return false;
	await plugin.tasks.removeList(list.id);
	return true;
}
