import { TFile } from "obsidian";
import type OmniCalendarPlugin from "./main";
import { ViewMode } from "./types";
import { EventModal } from "./modals/EventModal";
import { TaskModal } from "./modals/TaskModal";
import { exportLocalEvents } from "./icsExport";
import { parseLocal, startOfDay } from "./dateUtils";

/** Register the plugin's commands (command palette / hotkeys). The command ids must stay stable. */
export function registerCommands(plugin: OmniCalendarPlugin) {
	const { sidebar } = plugin;
	const add = (id: string, name: string, callback: () => void) => plugin.addCommand({ id, name, callback });

	add("open-calendar", "Open calendar", () => void plugin.openCalendar());
	add("calendar-menu", "Calendar menu (open, sidebar, new event, settings)", () =>
		plugin.showCalendarMenu({ x: window.innerWidth / 2, y: window.innerHeight / 3 }));
	add("open-sidebar", "Show mini calendar in sidebar", () => void sidebar.showMini(true));
	add("toggle-sidebar-mini", "Toggle mini calendar in sidebar", () => void sidebar.toggle("mini"));
	add("toggle-sidebar-full", "Toggle day planner in sidebar", () => void sidebar.toggle("full"));
	add("new-event", "Create new event", () => new EventModal(plugin, { start: startOfDay(new Date()) }).open());
	add("refresh", "Refresh external calendars", () => void plugin.refreshCalendars());
	for (const mode of ["month", "week", "day", "agenda"] as ViewMode[]) {
		add(`open-${mode}`, `Open ${mode} view`, () => void plugin.openCalendar(new Date(), mode));
	}
	add("toggle-calendar-lock", "Lock or unlock the calendar (no dragging or creating by tapping)", () => void plugin.lock.toggle());
	add("export-ics", "Export local events to .ics file", () => void exportLocalEvents(plugin));

	// Tasks (hidden while tasks are turned off).
	const addTask = (id: string, name: string, run: () => void) =>
		plugin.addCommand({
			id,
			name,
			checkCallback: (checking) => {
				if (!plugin.settings.tasksEnabled) return false;
				if (!checking) run();
				return true;
			},
		});
	addTask("open-tasks", "Open tasks", () => void plugin.openTasks());
	addTask("toggle-tasks-sidebar", "Toggle tasks in sidebar", () => void sidebar.toggleTasks());
	addTask("new-task", "Create new task", () => new TaskModal(plugin).open());

	plugin.addCommand({
		id: "new-event-from-note",
		name: "Create event linked to current note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) return false;
			if (!checking) newEventFromNote(plugin, file);
			return true;
		},
	});
}

/** A note called "2026-11-14 Dentist" becomes an event "Dentist" on that day, linked to the note. */
function newEventFromNote(plugin: OmniCalendarPlugin, file: TFile) {
	const m = /(\d{4}-\d{2}-\d{2})/.exec(file.basename);
	const day = m ? parseLocal(m[1]) : startOfDay(new Date());
	const title = file.basename.replace(/^\d{4}-\d{2}-\d{2}\s*/, "") || file.basename;
	new EventModal(plugin, { start: day, title, notePath: file.path }).open();
}
