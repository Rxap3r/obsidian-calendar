import type OmniCalendarPlugin from "../main";
import { CalendarStore } from "../store";
import { CalendarOccurrence, LocalEvent, RecurrenceFreq } from "../types";
import { addDays, addMinutes, toDateKey, toTimeKey } from "../dateUtils";

/** What the event dialog is opened with, and how that becomes the content of its fields. */

export interface EventModalInit {
	/** Existing event to edit. */
	event?: LocalEvent;
	/** For recurring events: the occurrence the user clicked (YYYY-MM-DD). */
	occurrenceDate?: string;
	/** Defaults for a new event. */
	start?: Date;
	end?: Date;
	allDay?: boolean;
	title?: string;
	location?: string;
	description?: string;
	calendarId?: string;
	/** Link a new event to an existing note. */
	notePath?: string;
	/** Existing Google / Outlook event occurrence to edit. */
	remote?: CalendarOccurrence;
}

/** What the fields of the dialog hold. Dates are "YYYY-MM-DD", times "HH:MM". */
export interface EventForm {
	title: string;
	/** Existing events: the calendar the event is (or will be) in. New events: the first of `targets`. */
	calendarId: string;
	/** New events: every calendar the event will be created in. */
	targets: string[];
	allDay: boolean;
	startDate: string;
	startTime: string;
	/** Last day, inclusive (also for all-day events). */
	endDate: string;
	endTime: string;
	location: string;
	description: string;
	freq: RecurrenceFreq | "none";
	interval: number;
	endsMode: "never" | "until" | "count";
	until: string;
	count: number;
}

/** A local event as it is stored, without the fields the store fills in. */
export type LocalEventData = Pick<LocalEvent, "title" | "calendarId" | "allDay" | "start" | "end" | "location" | "description" | "recurrence">;

const NO_REPEAT = { freq: "none", interval: 1, endsMode: "never", until: "", count: 10 } as const;

/** The date and time fields for an event from `start` to `end` (exclusive end, as in occurrences). */
function whenFields(start: Date, end: Date, allDay: boolean) {
	return {
		allDay,
		startDate: toDateKey(start),
		startTime: toTimeKey(start),
		endDate: toDateKey(allDay ? addDays(end, -1) : end),
		endTime: toTimeKey(end),
	};
}

/** An existing Google / Outlook event (one occurrence). */
export function formFromRemote(occ: CalendarOccurrence): EventForm {
	return {
		title: occ.title,
		calendarId: occ.sourceId,
		targets: [],
		...whenFields(occ.start, occ.end, occ.allDay),
		location: occ.location ?? "",
		description: occ.description ?? "",
		...NO_REPEAT,
	};
}

/** An existing local event. */
export function formFromLocal(ev: LocalEvent): EventForm {
	const { start, end } = CalendarStore.bounds(ev);
	const r = ev.recurrence;
	return {
		title: ev.title,
		calendarId: ev.calendarId,
		targets: [],
		...whenFields(start, end, ev.allDay),
		location: ev.location ?? "",
		description: ev.description ?? "",
		freq: r?.freq ?? "none",
		interval: r?.interval ?? 1,
		endsMode: r?.until ? "until" : r?.count ? "count" : "never",
		until: r?.until ?? "",
		count: r?.count ?? 10,
	};
}

/** A new event, from what the caller already knows (day, time range, title, …). */
export function formForNew(plugin: OmniCalendarPlugin, init: EventModalInit): EventForm {
	const store = plugin.store;
	const day = init.start ?? new Date();
	const allDay = init.allDay ?? false;
	// A start without an explicit end and at midnight means "a day was picked, not a time".
	const timeGiven = !!init.start && (!!init.end || day.getHours() + day.getMinutes() > 0);
	let start: Date;
	let end: Date;
	if (timeGiven && !allDay) {
		start = day;
		end = init.end ?? addMinutes(start, plugin.settings.defaultEventDuration);
	} else {
		({ start, end } = store.defaultTimes(day));
	}
	const targets = init.calendarId ? [init.calendarId] : store.defaultTargets().map((t) => t.id);
	return {
		title: init.title ?? "",
		targets,
		calendarId: targets[0] ?? store.defaultLocalSource()?.id ?? "",
		allDay,
		startDate: toDateKey(allDay ? day : start),
		startTime: toTimeKey(start),
		endDate: allDay ? toDateKey(init.end ? addDays(init.end, -1) : day) : toDateKey(end),
		endTime: toTimeKey(end),
		location: init.location ?? "",
		description: init.description ?? "",
		...NO_REPEAT,
	};
}
