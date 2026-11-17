export type SidebarView = "none" | "mini" | "full";

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
	/**
	 * Vault paths of linked notes (1.8+). Never parsed or modified. For repeating events these are the
	 * series' notes; a single occurrence keeps its own in `PluginData.eventLinks`.
	 */
	links?: string[];
	/** @deprecated ≤ 1.7: the one note of an event; migrated into `links` on load. */
	notePath?: string;
	recurrence?: Recurrence;
	/** Start dates (YYYY-MM-DD) of occurrences removed from a recurring series. */
	exdates?: string[];
	created: number;
	updated: number;
}

export type CalendarSourceType = "local" | "ics" | "google" | "outlook";

export type AccountProvider = "google" | "outlook";

/**
 * A connected Google / Microsoft account. Only non-secret configuration lives here
 * (it is saved in data.json). Tokens and the Google client secret are kept in
 * Obsidian's SecretStorage on each device and never written to the vault.
 */
export interface Account {
	id: string;
	provider: AccountProvider;
	/** E-mail / display label, filled in after sign-in. */
	label: string;
	/** The user renamed the account; keep their label on reconnect. */
	customLabel?: boolean;
	/** OAuth client ID of the user's own app registration. */
	clientId: string;
	/** Microsoft only: "common", "consumers", "organizations" or a tenant ID. */
	tenant?: string;
}

export interface CalendarSource {
	id: string;
	name: string;
	color: string;
	type: CalendarSourceType;
	enabled: boolean;
	/** ICS only: https://, webcal:// URL or a vault path to an .ics file. */
	url?: string;
	/** Google / Outlook only: the connected account. */
	accountId?: string;
	/** Google / Outlook only: the calendar ID at the provider. */
	remoteId?: string;
	/** Google / Outlook only: the account may not write to this calendar. */
	readOnly?: boolean;
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
	/** Google / Outlook events: identifiers needed to edit or delete the event remotely. */
	remote?: RemoteRef;
}

export interface RemoteRef {
	/** Event (or occurrence / instance) ID at the provider. */
	id: string;
	/** ID of the recurring series this occurrence belongs to. */
	seriesId?: string;
	/** Version tag used to avoid overwriting newer remote changes. */
	etag?: string;
}

/** Provider-neutral event data used to create / update remote events. */
export interface EventInput {
	title: string;
	allDay: boolean;
	start: Date;
	/** Exclusive end (for all-day events: midnight after the last day). */
	end: Date;
	location?: string;
	description?: string;
	recurrence?: Recurrence;
}

/** An event as returned by a provider API. */
export interface RemoteEvent {
	id: string;
	seriesId?: string;
	etag?: string;
	title: string;
	start: Date;
	end: Date;
	allDay: boolean;
	location?: string;
	description?: string;
	url?: string;
}

export interface SourceStatus {
	lastFetched?: number;
	error?: string;
	eventCount?: number;
	loading?: boolean;
}

export interface OmniCalendarSettings {
	firstDayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
	use24h: boolean;
	defaultView: ViewMode;
	showWeekNumbers: boolean;
	scrollToHour: number;
	defaultEventDuration: number; // minutes
	refreshIntervalMinutes: number;
	agendaDays: number;
	sidebarUpcomingDays: number;
	/**
	 * Week / day view: where events with a time that run over several days go. "grid": one block per day in the hour
	 * grid (09:00 →, → 10:00). "allday": in the all-day row, labelled with the whole span ("Mon 09:00 – Tue 10:00").
	 */
	multiDayTimed: "grid" | "allday";
	/** What clicking an event or task opens: the read-only details view (1.9+, default) or the edit dialog. */
	clickOpens: "details" | "edit";
	/** Language of dates, weekday and month names: Obsidian's language (default), the device's, or English. */
	dateLanguage: "obsidian" | "device" | "en";
	/** Which sidebar the calendar is placed in by the toggle commands. */
	sidebarSide: "left" | "right";
	/**
	 * What lives in the sidebar: nothing, the mini calendar or the full calendar.
	 * Applied immediately when changed and restored on startup; kept in sync when the
	 * user closes or drags the sidebar calendar themselves.
	 */
	sidebarView: SidebarView;
	/** View the sidebar "Day planner" (full calendar in the sidebar) opens in; remembered separately from the main calendar. */
	sidebarCalendarMode: ViewMode;
	/** What happens to the Day planner in the sidebar when its "open full page" button is used. */
	sidebarOnExpand: "mini" | "close" | "keep";
	/** With sidebarOnExpand "close": view type of the sidebar tab to show afterwards (e.g. "file-explorer"); "" = Obsidian decides. */
	sidebarAfterClose: string;
	/** Main switch for tasks: off hides the Tasks page, menu entries and commands (nothing is deleted). */
	tasksEnabled: boolean;
	/** Show the Tasks page in the sidebar (independent of the mini calendar / day planner). */
	tasksSidebar: boolean;
	/** Show ticked-off tasks in the lists (a "Done" section). */
	tasksShowCompleted: boolean;
	tasksDefaultPriority: TaskPriority;
	tasksDefaultListId: string;
	/** How many days after today the "Upcoming" task list covers. */
	tasksUpcomingDays: number;
	/** Completed tasks shown in Done (days since completion); -1 = everything. Older ones behind "Show older". */
	tasksDoneVisibleDays: number;
	/** Delete completed tasks this many days after completion; 0 = never. */
	tasksDeleteDoneAfterDays: number;
	/** Show tasks in the calendar (time blocks, one counter per day). */
	tasksInCalendar: boolean;
	/** Completed tasks in the calendar: shown struck through (true) or hidden. */
	tasksCalendarShowDone: boolean;
	/** "Tasks today" section in the mini calendar. */
	tasksInMiniCalendar: boolean;
	/** Progress log of tasks (details view + "📝 n" hint in lists). Off hides it; entries are kept. */
	tasksProgressLog: boolean;
	/** "Create note" on tasks – main switch: off also turns off the subtask part (1.9.3). Off hides; nothing is deleted. */
	tasksNoteExtras: boolean;
	/** Subtask descriptions, subtask notes and "Create note" on subtasks (1.9.4). Only counts while tasksNoteExtras is on. */
	tasksSubtaskExtras: boolean;
	/** @deprecated replaced by sidebarView (migrated on load). */
	sidebarOnStartup?: SidebarView;
	notesFolder: string;
	noteTemplate: string;
	/** Template of "Create note" on tasks and subtasks (1.9.3). */
	taskNoteTemplate: string;
	defaultCalendarId: string;
	/** Calendars new events are saved to by default (local and/or Google / Outlook). */
	defaultTargets: string[];
	sources: CalendarSource[];
	accounts: Account[];
}

export interface PluginData {
	settings: OmniCalendarSettings;
	events: LocalEvent[];
	/** Tasks (1.7+). Kept in data.json like local events, so it syncs the same way. */
	tasks: TaskData;
	/**
	 * Linked notes of events that can't store them themselves (1.8+): Google / Outlook and ICS events, and
	 * single occurrences of repeating local events. Keyed by `eventKey()`. Kept only in Obsidian.
	 */
	eventLinks: Record<string, string[]>;
}

// ---------------------------------------------------------------------- tasks

/** 0 = none, 1 = low, 2 = medium, 3 = high. */
export type TaskPriority = 0 | 1 | 2 | 3;

export interface TaskList {
	id: string;
	name: string;
	color: string;
}

export interface Subtask {
	id: string;
	title: string;
	done: boolean;
	/** Short optional description (1.9.3). Longer content belongs in a note. */
	description?: string;
	/** Vault paths of linked notes (1.9.3). Never parsed or modified. */
	links: string[];
}

export interface Task {
	id: string;
	title: string;
	notes?: string;
	listId: string;
	priority: TaskPriority;
	/** YYYY-MM-DD, or undefined for "no date". */
	date?: string;
	/** HH:MM (needs a date). */
	start?: string;
	/** HH:MM, optional end of a time range (needs start). */
	end?: string;
	/** One level only. */
	subtasks: Subtask[];
	done: boolean;
	/** ms timestamp when ticked off. */
	completedAt?: number;
	createdAt: number;
	/** Vault paths of linked notes. Never parsed or modified. */
	links: string[];
	/** The event this task belongs to (1.8+). Stored only in Obsidian, also for Google / Outlook events. */
	event?: TaskEventLink;
	/** Progress log (1.9.2): timestamped entries, oldest first. Separate from subtasks. */
	log?: TaskLogEntry[];
}

/** One entry of a task's progress log. */
export interface TaskLogEntry {
	id: string;
	/** ms timestamp when the entry was written. Editing keeps it. */
	at: number;
	text: string;
	/** ms timestamp of the last edit, if any. */
	editedAt?: number;
}

/** A task's link to an event (or one occurrence of a repeating event). */
export interface TaskEventLink {
	/** `eventKey()` of the event occurrence. */
	key: string;
	/** The event's title when it was linked (shown in task lists; updated when the event is seen). */
	title: string;
	/** Day of the occurrence (YYYY-MM-DD), used to find the event again. */
	date: string;
	/**
	 * "Track as task" (1.8.4): this task *is* the event – ticking it off marks the event as done. Its title, day and
	 * time follow the event; it is shown in task lists but not drawn a second time in the calendar.
	 */
	self?: boolean;
}

export interface TaskData {
	lists: TaskList[];
	items: Task[];
}

export type SmartListId = "today" | "tomorrow" | "upcoming" | "overdue" | "nodate" | "all" | "done";
