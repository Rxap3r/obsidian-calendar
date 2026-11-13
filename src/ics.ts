import ICAL from "ical.js";
import { CalendarOccurrence, CalendarSource } from "./types";
import { addDays, zonedTimeToDate } from "./dateUtils";

/** Common Windows time zone names (used by Outlook / Exchange) mapped to IANA names. */
const WINDOWS_TZ: Record<string, string> = {
	"W. Europe Standard Time": "Europe/Berlin",
	"Central Europe Standard Time": "Europe/Budapest",
	"Romance Standard Time": "Europe/Paris",
	"Central European Standard Time": "Europe/Warsaw",
	"GMT Standard Time": "Europe/London",
	"Greenwich Standard Time": "Atlantic/Reykjavik",
	"E. Europe Standard Time": "Europe/Chisinau",
	"FLE Standard Time": "Europe/Kiev",
	"GTB Standard Time": "Europe/Bucharest",
	"Russian Standard Time": "Europe/Moscow",
	"Eastern Standard Time": "America/New_York",
	"Central Standard Time": "America/Chicago",
	"Mountain Standard Time": "America/Denver",
	"US Mountain Standard Time": "America/Phoenix",
	"Pacific Standard Time": "America/Los_Angeles",
	"Alaskan Standard Time": "America/Anchorage",
	"Hawaiian Standard Time": "Pacific/Honolulu",
	"Atlantic Standard Time": "America/Halifax",
	"E. South America Standard Time": "America/Sao_Paulo",
	"India Standard Time": "Asia/Kolkata",
	"China Standard Time": "Asia/Shanghai",
	"Tokyo Standard Time": "Asia/Tokyo",
	"Korea Standard Time": "Asia/Seoul",
	"Singapore Standard Time": "Asia/Singapore",
	"AUS Eastern Standard Time": "Australia/Sydney",
	"New Zealand Standard Time": "Pacific/Auckland",
	"UTC": "UTC",
};

function resolveTimeZone(tzid: string): string | null {
	const cleaned = tzid.replace(/^\/+/, "").replace(/^"|"$/g, "");
	const candidate = WINDOWS_TZ[cleaned] ?? cleaned;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: candidate });
		return candidate;
	} catch {
		return null;
	}
}

function toDate(t: ICAL.Time, tzid: string | null): Date {
	if (t.isDate) return new Date(t.year, t.month - 1, t.day);
	// ical.js falls back to "floating" local time when a TZID has no VTIMEZONE
	// definition. Try to interpret it as an IANA / Windows zone name instead.
	if (tzid && t.zone === ICAL.Timezone.localTimezone) {
		const iana = resolveTimeZone(tzid);
		if (iana) {
			const d = zonedTimeToDate(t.year, t.month, t.day, t.hour, t.minute, t.second, iana);
			if (d) return d;
		}
	}
	return t.toJSDate();
}

function text(v: unknown): string | undefined {
	if (v === null || v === undefined) return undefined;
	const s = String(v).trim();
	return s.length ? s : undefined;
}

/** A parsed ICS calendar that can lazily expand occurrences for any range. */
export class IcsCalendar {
	private events: ICAL.Event[] = [];
	private cache = new Map<string, CalendarOccurrence[]>();

	constructor(public source: CalendarSource, raw: string) {
		const jcal = ICAL.parse(raw);
		const root = new ICAL.Component(jcal);
		const calendars = root.name === "vcalendar" ? [root] : root.getAllSubcomponents("vcalendar");

		for (const cal of calendars) {
			for (const tz of cal.getAllSubcomponents("vtimezone")) {
				try {
					ICAL.TimezoneService.register(tz);
				} catch (e) {
					console.warn("Calendar Hub: could not register time zone", e);
				}
			}
		}

		const masters = new Map<string, ICAL.Event>();
		const exceptions: ICAL.Event[] = [];
		for (const cal of calendars) {
			for (const vevent of cal.getAllSubcomponents("vevent")) {
				try {
					const ev = new ICAL.Event(vevent, { strictExceptions: false });
					if (!ev.startDate) continue;
					if (ev.isRecurrenceException()) exceptions.push(ev);
					else masters.set(ev.uid ?? Math.random().toString(36), ev);
				} catch (e) {
					console.warn("Calendar Hub: skipping malformed event", e);
				}
			}
		}
		for (const ex of exceptions) {
			const master = ex.uid ? masters.get(ex.uid) : undefined;
			if (master) master.relateException(ex);
			else this.events.push(ex); // orphaned exception: show as a single event
		}
		this.events.push(...masters.values());
	}

	get eventCount(): number {
		return this.events.length;
	}

	getOccurrences(rangeStart: Date, rangeEnd: Date): CalendarOccurrence[] {
		const key = `${rangeStart.getTime()}-${rangeEnd.getTime()}-${this.source.color}`;
		const hit = this.cache.get(key);
		if (hit) return hit;
		const out: CalendarOccurrence[] = [];
		for (const ev of this.events) {
			try {
				this.expand(ev, rangeStart, rangeEnd, out);
			} catch (e) {
				console.warn("Calendar Hub: failed to expand event", ev.summary, e);
			}
		}
		if (this.cache.size > 30) this.cache.clear();
		this.cache.set(key, out);
		return out;
	}

	private expand(ev: ICAL.Event, rangeStart: Date, rangeEnd: Date, out: CalendarOccurrence[]) {
		const tzid = (ev.component.getFirstProperty("dtstart")?.getParameter("tzid") as string | undefined) ?? null;
		const endTzid = (ev.component.getFirstProperty("dtend")?.getParameter("tzid") as string | undefined) ?? tzid;

		const push = (item: ICAL.Event, s: ICAL.Time, e: ICAL.Time | null, recurring: boolean) => {
			const status = String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase();
			if (status === "CANCELLED") return;
			const allDay = s.isDate;
			const start = toDate(s, tzid);
			let end = e ? toDate(e, endTzid) : start;
			if (end <= start) end = allDay ? addDays(start, 1) : start;
			if (end < rangeStart || start >= rangeEnd) return;
			if (end.getTime() === rangeStart.getTime() && end.getTime() !== start.getTime()) return;
			out.push({
				key: `${this.source.id}:${item.uid}:${start.getTime()}`,
				sourceId: this.source.id,
				title: text(item.summary) ?? "(No title)",
				start,
				end,
				allDay,
				location: text(item.location),
				description: text(item.description),
				url: text(item.component.getFirstPropertyValue("url")),
				color: this.source.color,
				readOnly: true,
				recurring,
			});
		};

		if (!ev.isRecurring()) {
			push(ev, ev.startDate, ev.endDate, false);
			return;
		}

		const it = ev.iterator();
		let next: ICAL.Time | null;
		let guard = 0;
		while ((next = it.next()) && guard++ < 50000) {
			const details = ev.getOccurrenceDetails(next);
			const occStart = toDate(details.startDate, tzid);
			if (occStart >= rangeEnd) {
				// Exceptions can move an occurrence earlier, but the recurrence-id order is still monotonic.
				if (toDate(next, tzid) >= rangeEnd) break;
			}
			push(details.item, details.startDate, details.endDate, true);
		}
	}
}

/** Normalize a calendar URL for fetching (webcal:// -> https://). */
export function normalizeIcsUrl(url: string): string {
	const u = url.trim();
	if (/^webcals?:\/\//i.test(u)) return u.replace(/^webcals?:\/\//i, "https://");
	return u;
}

export function isRemoteUrl(url: string): boolean {
	return /^(https?|webcals?):\/\//i.test(url.trim());
}

/** Serialize local occurrences to an .ics file (for export / import into other apps). */
export function buildIcs(
	events: { uid: string; title: string; start: Date; end: Date; allDay: boolean; location?: string; description?: string; rrule?: string; exdates?: Date[] }[],
	calName: string
): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	const dateVal = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
	const utcVal = (d: Date) =>
		`${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
	const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
	const fold = (line: string) => {
		const parts: string[] = [];
		let rest = line;
		while (rest.length > 74) {
			parts.push(rest.slice(0, 74));
			rest = " " + rest.slice(74);
		}
		parts.push(rest);
		return parts.join("\r\n");
	};
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Calendar Hub//Obsidian//EN",
		"CALSCALE:GREGORIAN",
		`X-WR-CALNAME:${esc(calName)}`,
	];
	const stamp = utcVal(new Date());
	for (const e of events) {
		lines.push("BEGIN:VEVENT", `UID:${e.uid}@calendar-hub`, `DTSTAMP:${stamp}`);
		if (e.allDay) {
			lines.push(`DTSTART;VALUE=DATE:${dateVal(e.start)}`, `DTEND;VALUE=DATE:${dateVal(e.end)}`);
		} else {
			lines.push(`DTSTART:${utcVal(e.start)}`, `DTEND:${utcVal(e.end)}`);
		}
		lines.push(`SUMMARY:${esc(e.title)}`);
		if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
		if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
		if (e.rrule) lines.push(`RRULE:${e.rrule}`);
		for (const x of e.exdates ?? []) {
			lines.push(e.allDay ? `EXDATE;VALUE=DATE:${dateVal(x)}` : `EXDATE:${utcVal(x)}`);
		}
		lines.push("END:VEVENT");
	}
	lines.push("END:VCALENDAR");
	return lines.map(fold).join("\r\n") + "\r\n";
}
