export type ViewMode = "month" | "week" | "day" | "agenda";

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface Recurrence {
	freq: RecurrenceFreq;
	/** Repeat every N units (>= 1). */
	interval: number;
	/** Last date (inclusive, YYYY-MM-DD) on which an occurrence may start. */
	until?: string;
	/** Maximum number of occurrences. */
	count?: number;
}

/** An event created inside Obsidian and stored in the plugin's data.json. */
export interface LocalEvent {
	id: string;
	calendarId: string;
	title: string;
	allDay: boolean;
	/** All-day: "YYYY-MM-DD". Timed: "YYYY-MM-DDTHH:mm" (local time). */
	start: string;
	/** All-day: last day, inclusive ("YYYY-MM-DD"). Timed: "YYYY-MM-DDTHH:mm". */
	end: string;
	location?: string;
	description?: string;
	/** Vault path of a note linked to this event. */
	notePath?: string;
	recurrence?: Recurrence;
	/** Start dates (YYYY-MM-DD) of occurrences removed from a recurring series. */
	exdates?: string[];
	created: number;
	updated: number;
}

export type CalendarSourceType = "local" | "ics";

export interface CalendarSource {
	id: string;
	name: string;
	color: string;
	type: CalendarSourceType;
	enabled: boolean;
	/** ICS only: https://, webcal:// URL or a vault path to an .ics file. */
	url?: string;
}

/** A concrete, rendered occurrence of an event in a date range. */
export interface CalendarOccurrence {
	/** Unique key for this occurrence. */
	key: string;
	sourceId: string;
	/** Local event id (only for local events). */
	eventId?: string;
	title: string;
	start: Date;
	/** Exclusive end. For all-day events this is midnight after the last day. */
	end: Date;
	allDay: boolean;
	location?: string;
	description?: string;
	url?: string;
	color: string;
	readOnly: boolean;
	recurring: boolean;
	/** For local recurring events: start date of this occurrence (YYYY-MM-DD). */
	occurrenceDate?: string;
	notePath?: string;
}

export interface SourceStatus {
	lastFetched?: number;
	error?: string;
	eventCount?: number;
	loading?: boolean;
}

export interface CalendarHubSettings {
	firstDayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
	use24h: boolean;
	defaultView: ViewMode;
	showWeekNumbers: boolean;
	scrollToHour: number;
	defaultEventDuration: number; // minutes
	refreshIntervalMinutes: number;
	agendaDays: number;
	sidebarUpcomingDays: number;
	notesFolder: string;
	noteTemplate: string;
	defaultCalendarId: string;
	sources: CalendarSource[];
}

export interface PluginData {
	settings: CalendarHubSettings;
	events: LocalEvent[];
}
