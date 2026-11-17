import { OmniCalendarSettings } from "./types";
import { DEFAULT_NOTE_TEMPLATE } from "./notes";

/** Colours offered for new calendars and task lists. */
export const PALETTE = ["#7c5cff", "#2f9e44", "#e8590c", "#1c7ed6", "#d6336c", "#f59f00", "#0ca678", "#ae3ec9", "#495057"];

/** The first palette colour that isn't in use yet; when all are used, they repeat in order. */
export function nextColor(used: Iterable<string>, count: number): string {
	const taken = new Set(used);
	return PALETTE.find((c) => !taken.has(c)) ?? PALETTE[count % PALETTE.length];
}

export const DEFAULT_SETTINGS: OmniCalendarSettings = {
	firstDayOfWeek: 1,
	use24h: true,
	defaultView: "month",
	showWeekNumbers: false,
	scrollToHour: 7,
	defaultEventDuration: 60,
	refreshIntervalMinutes: 30,
	agendaDays: 30,
	sidebarUpcomingDays: 7,
	multiDayTimed: "grid",
	clickOpens: "details",
	dateLanguage: "obsidian",
	sidebarSide: "right",
	sidebarView: "none",
	sidebarCalendarMode: "day",
	sidebarOnExpand: "mini",
	sidebarAfterClose: "",
	tasksEnabled: true,
	tasksSidebar: false,
	tasksShowCompleted: true,
	tasksDefaultPriority: 0,
	tasksDefaultListId: "tasks",
	tasksUpcomingDays: 7,
	tasksDoneVisibleDays: 30,
	tasksDeleteDoneAfterDays: 0,
	tasksInCalendar: true,
	tasksCalendarShowDone: true,
	tasksInMiniCalendar: true,
	notesFolder: "Calendar",
	noteTemplate: DEFAULT_NOTE_TEMPLATE,
	defaultCalendarId: "personal",
	defaultTargets: ["personal"],
	sources: [{ id: "personal", name: "Personal", color: PALETTE[0], type: "local", enabled: true }],
	accounts: [],
};
