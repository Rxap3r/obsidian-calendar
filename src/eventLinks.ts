import { CalendarOccurrence } from "./types";

/**
 * A stable key for an event occurrence, used to attach tasks and linked notes to it in Obsidian:
 * - local event: `local:<id>` (it keeps that key when it is moved), one repeat: `local:<id>@<YYYY-MM-DD>`;
 * - Google / Outlook: `<calendar>:<event id at the provider>` (each repeat has its own id there);
 * - ICS: the occurrence key (calendar, UID and start).
 */
export function eventKey(occ: CalendarOccurrence): string {
	if (occ.eventId) return occ.recurring && occ.occurrenceDate ? `local:${occ.eventId}@${occ.occurrenceDate}` : `local:${occ.eventId}`;
	return occ.key;
}
