import { Notice } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { CalendarOccurrence, TaskList } from "../types";
import { DEFAULT_TASK_LIST } from "../tasks";
import { errorMessage, plural } from "../util";
import { confirmAction } from "./ConfirmModal";

/**
 * Delete a Google / Outlook event after asking (remote deletes always ask).
 * `series` deletes every occurrence. Returns true when the event was deleted.
 */
export async function deleteRemoteEvent(plugin: OmniCalendarPlugin, occ: CalendarOccurrence, series: boolean): Promise<boolean> {
	const where = plugin.store.serviceName(occ.sourceId);
	const what = series ? "all occurrences of this event" : occ.recurring ? "this occurrence" : "this event";
	if (!(await confirmAction(plugin.app, "Delete event?", `"${occ.title}" – ${what} will be permanently deleted from ${where}.`))) return false;
	try {
		await plugin.store.deleteRemote(occ, series);
		new Notice(`Deleted "${occ.title}" from ${where}`);
		return true;
	} catch (e) {
		new Notice(`Could not delete: ${errorMessage(e)}`, 8000);
		return false;
	}
}

/** Delete a task list after asking; its tasks move to the default list. Returns true when it was deleted. */
export async function deleteTaskList(plugin: OmniCalendarPlugin, list: TaskList): Promise<boolean> {
	const n = plugin.tasks.items.filter((t) => t.listId === list.id).length;
	const msg = n ? `Delete “${list.name}”? Its ${plural(n, "task")} will move to “${DEFAULT_TASK_LIST.name}”.` : `Delete “${list.name}”?`;
	if (!(await confirmAction(plugin.app, "Delete list", msg))) return false;
	await plugin.tasks.removeList(list.id);
	return true;
}
