import type OmniCalendarPlugin from "../../main";
import { Task } from "../../types";
import { TaskDetailsModal } from "../../modals/TaskDetailsModal";
import { TaskModal } from "../../modals/TaskModal";
import { openOccurrence } from "../shared";
import { openTaskEvent } from "./helpers";

/**
 * A click on a task: its details view (default, setting "Clicking opens") or the task dialog directly.
 * A tracked event ("Track as task") opens its event instead.
 */
export function openTask(plugin: OmniCalendarPlugin, t: Task) {
	if (t.event?.self) {
		void openTaskEvent(plugin, t, (occ) => openOccurrence(plugin, occ));
		return;
	}
	if (plugin.settings.clickOpens === "edit") new TaskModal(plugin, t).open();
	else new TaskDetailsModal(plugin, t).open();
}
