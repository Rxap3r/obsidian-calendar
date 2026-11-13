import { requestUrl } from "obsidian";
import { Account, EventInput, Recurrence, RemoteEvent } from "../types";
import { addDays, parseLocal, toDateKey, toTimeKey } from "../dateUtils";
import { OAuthProviderConfig } from "./oauth";
import { apiRequest, TokenGetter } from "./http";

export interface RemoteCalendarInfo {
	id: string;
	name: string;
	color?: string;
	readOnly: boolean;
	primary: boolean;
	/** Owner e-mail (Outlook), used as account label. */
	owner?: string;
}

export interface CalendarProvider {
	readonly label: string;
	oauthConfig(account: Account, clientSecret?: string): OAuthProviderConfig;
	listCalendars(t: TokenGetter): Promise<RemoteCalendarInfo[]>;
	listEvents(t: TokenGetter, calendarId: string, from: Date, to: Date): Promise<RemoteEvent[]>;
	createEvent(t: TokenGetter, calendarId: string, input: EventInput): Promise<void>;
	updateEvent(t: TokenGetter, calendarId: string, eventId: string, input: EventInput, etag?: string): Promise<void>;
	deleteEvent(t: TokenGetter, calendarId: string, eventId: string, etag?: string): Promise<void>;
	/** Revoke a refresh token (best effort). */
	revoke?(refreshToken: string): Promise<void>;
}

const MAX_PAGES = 40;

function localTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}

/** Wall-clock local time without offset, e.g. 2026-11-13T09:30:00 */
function localIso(d: Date): string {
	return `${toDateKey(d)}T${toTimeKey(d)}:00`;
}

function pad(n: number) {
	return String(n).padStart(2, "0");
}

function rrule(r: Recurrence, allDay: boolean): string {
	let rule = `RRULE:FREQ=${r.freq.toUpperCase()};INTERVAL=${Math.max(1, r.interval || 1)}`;
	if (r.count) rule += `;COUNT=${r.count}`;
	else if (r.until) {
		if (allDay) rule += `;UNTIL=${r.until.replace(/-/g, "")}`;
		else {
			const u = addDays(parseLocal(r.until), 1);
			u.setSeconds(u.getSeconds() - 1);
			rule += `;UNTIL=${u.getUTCFullYear()}${pad(u.getUTCMonth() + 1)}${pad(u.getUTCDate())}T${pad(u.getUTCHours())}${pad(u.getUTCMinutes())}${pad(u.getUTCSeconds())}Z`;
		}
	}
	return rule;
}

function enc(s: string) {
	return encodeURIComponent(s);
}

// ============================================================================ Google

const GOOGLE_API = "https://www.googleapis.com/calendar/v3";

export const GoogleProvider: CalendarProvider = {
	label: "Google",

	oauthConfig(account, clientSecret) {
		return {
			authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
			tokenUrl: "https://oauth2.googleapis.com/token",
			clientId: account.clientId,
			clientSecret,
			// Least privilege: events read/write + read-only list of calendars. No e-mail, contacts or profile.
			scopes: [
				"https://www.googleapis.com/auth/calendar.events",
				"https://www.googleapis.com/auth/calendar.calendarlist.readonly",
			],
			extraAuthParams: { access_type: "offline", prompt: "consent" },
			redirectHost: "127.0.0.1",
		};
	},

	async listCalendars(t) {
		const out: RemoteCalendarInfo[] = [];
		let pageToken: string | undefined;
		for (let i = 0; i < MAX_PAGES; i++) {
			const q = new URLSearchParams({ maxResults: "250", minAccessRole: "reader" });
			if (pageToken) q.set("pageToken", pageToken);
			const j = await apiRequest(t, { url: `${GOOGLE_API}/users/me/calendarList?${q}` });
			for (const c of j?.items ?? []) {
				out.push({
					id: String(c.id),
					name: String(c.summaryOverride ?? c.summary ?? c.id),
					color: c.backgroundColor,
					readOnly: !(c.accessRole === "owner" || c.accessRole === "writer"),
					primary: !!c.primary,
				});
			}
			pageToken = j?.nextPageToken;
			if (!pageToken) break;
		}
		return out;
	},

	async listEvents(t, calendarId, from, to) {
		const out: RemoteEvent[] = [];
		let pageToken: string | undefined;
		for (let i = 0; i < MAX_PAGES; i++) {
			const q = new URLSearchParams({
				singleEvents: "true",
				timeMin: from.toISOString(),
				timeMax: to.toISOString(),
				maxResults: "2500",
				showDeleted: "false",
			});
			if (pageToken) q.set("pageToken", pageToken);
			const j = await apiRequest(t, { url: `${GOOGLE_API}/calendars/${enc(calendarId)}/events?${q}` });
			for (const e of j?.items ?? []) {
				if (e.status === "cancelled" || !e.start) continue;
				const allDay = !!e.start.date;
				const start = allDay ? parseLocal(e.start.date) : new Date(e.start.dateTime);
				let end = allDay ? parseLocal(e.end?.date ?? e.start.date) : new Date(e.end?.dateTime ?? e.start.dateTime);
				if (allDay && end <= start) end = addDays(start, 1);
				if (isNaN(start.getTime())) continue;
				out.push({
					id: String(e.id),
					seriesId: e.recurringEventId ? String(e.recurringEventId) : undefined,
					etag: e.etag,
					title: String(e.summary ?? "(No title)"),
					start,
					end,
					allDay,
					location: e.location,
					description: e.description,
					url: e.htmlLink,
				});
			}
			pageToken = j?.nextPageToken;
			if (!pageToken) break;
		}
		return out;
	},

	async createEvent(t, calendarId, input) {
		await apiRequest(t, {
			url: `${GOOGLE_API}/calendars/${enc(calendarId)}/events`,
			method: "POST",
			body: googleBody(input, false),
		});
	},

	async updateEvent(t, calendarId, eventId, input, etag) {
		await apiRequest(t, {
			url: `${GOOGLE_API}/calendars/${enc(calendarId)}/events/${enc(eventId)}`,
			method: "PATCH",
			body: googleBody(input, true),
			headers: etag ? { "If-Match": etag } : undefined,
		});
	},

	async deleteEvent(t, calendarId, eventId, etag) {
		await apiRequest(t, {
			url: `${GOOGLE_API}/calendars/${enc(calendarId)}/events/${enc(eventId)}`,
			method: "DELETE",
			headers: etag ? { "If-Match": etag } : undefined,
		});
	},

	async revoke(refreshToken) {
		await requestUrl({
			url: "https://oauth2.googleapis.com/revoke",
			method: "POST",
			contentType: "application/x-www-form-urlencoded",
			body: new URLSearchParams({ token: refreshToken }).toString(),
			throw: false,
		});
	},
};

function googleBody(input: EventInput, patch: boolean) {
	const tz = localTimeZone();
	const time = (d: Date) =>
		input.allDay
			? { date: toDateKey(d), ...(patch ? { dateTime: null, timeZone: null } : {}) }
			: { dateTime: localIso(d), timeZone: tz, ...(patch ? { date: null } : {}) };
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const body: any = {
		summary: input.title,
		location: input.location ?? (patch ? "" : undefined),
		description: input.description ?? (patch ? "" : undefined),
		start: time(input.start),
		end: time(input.end),
	};
	// The repeat rule of an existing event is edited in Google Calendar itself.
	if (input.recurrence && !patch) body.recurrence = [rrule(input.recurrence, input.allDay)];
	return body;
}

// ============================================================================ Microsoft (Outlook / Microsoft 365)

const GRAPH = "https://graph.microsoft.com/v1.0";
const GRAPH_PREFER = 'outlook.timezone="UTC", outlook.body-content-type="text"';
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Parse a Graph dateTime ("2026-11-13T09:00:00.0000000") that is in UTC. */
function graphUtc(s: string): Date {
	return new Date(`${s.slice(0, 19)}Z`);
}

export const OutlookProvider: CalendarProvider = {
	label: "Outlook",

	oauthConfig(account) {
		const tenant = /^[a-z0-9.-]+$/i.test(account.tenant ?? "") ? (account.tenant as string) : "common";
		return {
			authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
			tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
			clientId: account.clientId,
			// Least privilege: calendars only. offline_access = refresh token.
			scopes: ["offline_access", "https://graph.microsoft.com/Calendars.ReadWrite"],
			extraAuthParams: { response_mode: "query", prompt: "select_account" },
			redirectHost: "localhost",
		};
	},

	async listCalendars(t) {
		const out: RemoteCalendarInfo[] = [];
		let url: string | undefined = `${GRAPH}/me/calendars?$top=100&$select=id,name,hexColor,canEdit,isDefaultCalendar,owner`;
		for (let i = 0; i < MAX_PAGES && url; i++) {
			const j = await apiRequest(t, { url });
			for (const c of j?.value ?? []) {
				out.push({
					id: String(c.id),
					name: String(c.name ?? "Calendar"),
					color: c.hexColor || undefined,
					readOnly: c.canEdit === false,
					primary: !!c.isDefaultCalendar,
					owner: c.owner?.address || undefined,
				});
			}
			url = j?.["@odata.nextLink"];
		}
		return out;
	},

	async listEvents(t, calendarId, from, to) {
		const out: RemoteEvent[] = [];
		const q = new URLSearchParams({
			startDateTime: from.toISOString(),
			endDateTime: to.toISOString(),
			$top: "500",
			$select: "id,subject,start,end,isAllDay,location,body,webLink,type,seriesMasterId,isCancelled",
		});
		let url: string | undefined = `${GRAPH}/me/calendars/${enc(calendarId)}/calendarView?${q}`;
		for (let i = 0; i < MAX_PAGES && url; i++) {
			const j = await apiRequest(t, { url, headers: { Prefer: GRAPH_PREFER } });
			for (const e of j?.value ?? []) {
				if (e.isCancelled || !e.start?.dateTime) continue;
				const allDay = !!e.isAllDay;
				const start = allDay ? parseLocal(String(e.start.dateTime).slice(0, 10)) : graphUtc(e.start.dateTime);
				let end = allDay ? parseLocal(String(e.end?.dateTime ?? e.start.dateTime).slice(0, 10)) : graphUtc(e.end?.dateTime ?? e.start.dateTime);
				if (allDay && end <= start) end = addDays(start, 1);
				if (isNaN(start.getTime())) continue;
				out.push({
					id: String(e.id),
					seriesId: e.seriesMasterId ? String(e.seriesMasterId) : undefined,
					etag: e["@odata.etag"],
					title: String(e.subject ?? "(No title)"),
					start,
					end,
					allDay,
					location: e.location?.displayName || undefined,
					description: e.body?.content?.trim() || undefined,
					url: e.webLink,
				});
			}
			url = j?.["@odata.nextLink"];
		}
		return out;
	},

	async createEvent(t, calendarId, input) {
		await apiRequest(t, {
			url: `${GRAPH}/me/calendars/${enc(calendarId)}/events`,
			method: "POST",
			body: graphBody(input),
		});
	},

	async updateEvent(t, _calendarId, eventId, input, etag) {
		const body = graphBody(input);
		delete body.recurrence; // the repeat rule of an existing event is edited in Outlook
		await apiRequest(t, {
			url: `${GRAPH}/me/events/${enc(eventId)}`,
			method: "PATCH",
			body,
			headers: etag ? { "If-Match": etag } : undefined,
		});
	},

	async deleteEvent(t, _calendarId, eventId, etag) {
		await apiRequest(t, {
			url: `${GRAPH}/me/events/${enc(eventId)}`,
			method: "DELETE",
			headers: etag ? { "If-Match": etag } : undefined,
		});
	},
};

function graphBody(input: EventInput) {
	const tz = localTimeZone();
	const time = (d: Date) =>
		input.allDay ? { dateTime: `${toDateKey(d)}T00:00:00`, timeZone: tz } : { dateTime: localIso(d), timeZone: tz };
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const body: any = {
		subject: input.title,
		body: { contentType: "text", content: input.description ?? "" },
		location: { displayName: input.location ?? "" },
		isAllDay: input.allDay,
		start: time(input.start),
		end: time(input.end),
	};
	const r = input.recurrence;
	if (r) {
		const s = input.start;
		const interval = Math.max(1, r.interval || 1);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let pattern: any;
		switch (r.freq) {
			case "daily": pattern = { type: "daily", interval }; break;
			case "weekly": pattern = { type: "weekly", interval, daysOfWeek: [WEEKDAYS[s.getDay()]] }; break;
			case "monthly": pattern = { type: "absoluteMonthly", interval, dayOfMonth: s.getDate() }; break;
			case "yearly": pattern = { type: "absoluteYearly", interval, dayOfMonth: s.getDate(), month: s.getMonth() + 1 }; break;
		}
		const startDate = toDateKey(s);
		const range = r.count
			? { type: "numbered", startDate, numberOfOccurrences: r.count }
			: r.until
				? { type: "endDate", startDate, endDate: r.until }
				: { type: "noEnd", startDate };
		body.recurrence = { pattern, range };
	}
	return body;
}

export function providerFor(p: Account["provider"]): CalendarProvider {
	return p === "google" ? GoogleProvider : OutlookProvider;
}
