import { Events, normalizePath, requestUrl, TFile } from "obsidian";
import type OmniCalendarPlugin from "./main";
import { CalendarOccurrence, CalendarSource, EventInput, LocalEvent, RemoteEvent, SourceStatus } from "./types";
import { providerFor } from "./sync/providers";
import { ApiError } from "./sync/http";
import { IcsCalendar, isRemoteUrl, normalizeIcsUrl } from "./ics";
import {
	addDays, addMonths, addMinutes, dayDiff, isValidDate, parseLocal, startOfDay, toDateKey, uid,
} from "./dateUtils";

const MAX_LOCAL_OCCURRENCES = 5000;

/**
 * Central data layer: local events, external ICS calendars and change notifications.
 * Views subscribe with `store.on("changed", cb)`.
 */
export class CalendarStore extends Events {
	private ics = new Map<string, IcsCalendar>();
	/** Events of connected Google / Outlook calendars, kept in memory only. */
	private remote = new Map<string, RemoteEvent[]>();
	readonly status = new Map<string, SourceStatus>();

	constructor(private plugin: OmniCalendarPlugin) {
		super();
	}

	get settings() {
		return this.plugin.settings;
	}

	get events(): LocalEvent[] {
		return this.plugin.data.events;
	}

	notify() {
		this.trigger("changed");
	}

	getSource(id: string): CalendarSource | undefined {
		return this.settings.sources.find((s) => s.id === id);
	}

	localSources(): CalendarSource[] {
		return this.settings.sources.filter((s) => s.type === "local");
	}

	defaultLocalSource(): CalendarSource {
		const locals = this.localSources();
		return locals.find((s) => s.id === this.settings.defaultCalendarId) ?? locals[0];
	}

	// ---------------------------------------------------------------- local events

	async addEvent(ev: Omit<LocalEvent, "id" | "created" | "updated">): Promise<LocalEvent> {
		const now = Date.now();
		const full: LocalEvent = { ...ev, id: uid(), created: now, updated: now };
		this.events.push(full);
		await this.plugin.persist();
		this.notify();
		return full;
	}

	async updateEvent(id: string, patch: Partial<LocalEvent>): Promise<void> {
		const ev = this.events.find((e) => e.id === id);
		if (!ev) return;
		Object.assign(ev, patch, { updated: Date.now() });
		await this.plugin.persist();
		this.notify();
	}

	async deleteEvent(id: string): Promise<void> {
		this.plugin.data.events = this.events.filter((e) => e.id !== id);
		await this.plugin.persist();
		this.notify();
	}

	/** Remove a single occurrence from a recurring local event. */
	async excludeOccurrence(id: string, dateKey: string): Promise<void> {
		const ev = this.events.find((e) => e.id === id);
		if (!ev) return;
		ev.exdates = Array.from(new Set([...(ev.exdates ?? []), dateKey]));
		ev.updated = Date.now();
		await this.plugin.persist();
		this.notify();
	}

	getEvent(id: string): LocalEvent | undefined {
		return this.events.find((e) => e.id === id);
	}

	/** Start / exclusive end of a local event's first occurrence. */
	static bounds(ev: LocalEvent): { start: Date; end: Date } {
		const start = parseLocal(ev.start);
		let end: Date;
		if (ev.allDay) {
			end = addDays(parseLocal(ev.end || ev.start), 1);
		} else {
			end = parseLocal(ev.end || ev.start);
		}
		if (!isValidDate(end) || end < start) end = ev.allDay ? addDays(start, 1) : start;
		return { start, end };
	}

	private expandLocal(ev: LocalEvent, rangeStart: Date, rangeEnd: Date, out: CalendarOccurrence[]) {
		const source = this.getSource(ev.calendarId) ?? this.defaultLocalSource();
		if (!source || !source.enabled) return;
		const { start, end } = CalendarStore.bounds(ev);
		if (!isValidDate(start)) return;
		const durationMs = end.getTime() - start.getTime();
		const spanDays = dayDiff(start, end);

		const emit = (s: Date, e: Date, recurring: boolean) => {
			if (s >= rangeEnd) return;
			if (e < rangeStart || (e.getTime() === rangeStart.getTime() && e.getTime() !== s.getTime())) return;
			out.push({
				key: `local:${ev.id}:${s.getTime()}`,
				sourceId: source.id,
				eventId: ev.id,
				title: ev.title || "(No title)",
				start: s,
				end: e,
				allDay: ev.allDay,
				location: ev.location,
				description: ev.description,
				color: source.color,
				readOnly: false,
				recurring,
				occurrenceDate: toDateKey(s),
				notePath: ev.notePath,
			});
		};

		const rec = ev.recurrence;
		if (!rec) {
			emit(start, end, false);
			return;
		}

		const interval = Math.max(1, rec.interval || 1);
		const until = rec.until ? addDays(parseLocal(rec.until), 1) : null;
		const exdates = new Set(ev.exdates ?? []);
		for (let i = 0; i < MAX_LOCAL_OCCURRENCES; i++) {
			if (rec.count && i >= rec.count) break;
			let s: Date;
			switch (rec.freq) {
				case "daily": s = addDays(start, i * interval); break;
				case "weekly": s = addDays(start, i * 7 * interval); break;
				case "monthly": s = addMonths(start, i * interval); break;
				case "yearly": s = addMonths(start, i * 12 * interval); break;
				default: s = start;
			}
			if (until && s >= until) break;
			if (s >= rangeEnd) break;
			if (exdates.has(toDateKey(s))) continue;
			const e = ev.allDay ? addDays(s, spanDays) : new Date(s.getTime() + durationMs);
			emit(s, e, true);
		}
	}

	// ---------------------------------------------------------------- queries

	/** All visible occurrences overlapping [rangeStart, rangeEnd), sorted. */
	getOccurrences(rangeStart: Date, rangeEnd: Date, hidden?: Set<string>): CalendarOccurrence[] {
		const out: CalendarOccurrence[] = [];
		for (const ev of this.events) {
			if (hidden?.has(ev.calendarId)) continue;
			this.expandLocal(ev, rangeStart, rangeEnd, out);
		}
		for (const source of this.settings.sources) {
			if (!this.isRemoteSource(source) || !source.enabled || hidden?.has(source.id)) continue;
			for (const e of this.remote.get(source.id) ?? []) {
				if (e.start >= rangeEnd) continue;
				if (e.end < rangeStart || (e.end.getTime() === rangeStart.getTime() && e.end.getTime() !== e.start.getTime())) continue;
				out.push({
					key: `${source.id}:${e.id}`,
					sourceId: source.id,
					title: e.title,
					start: e.start,
					end: e.end,
					allDay: e.allDay,
					location: e.location,
					description: e.description,
					url: e.url,
					color: source.color,
					readOnly: !!source.readOnly || !this.plugin.accounts.getAccount(source.accountId),
					recurring: !!e.seriesId,
					remote: { id: e.id, seriesId: e.seriesId, etag: e.etag },
				});
			}
		}
		for (const source of this.settings.sources) {
			if (source.type !== "ics" || !source.enabled || hidden?.has(source.id)) continue;
			const cal = this.ics.get(source.id);
			if (cal) {
				cal.source = source;
				out.push(...cal.getOccurrences(rangeStart, rangeEnd));
			}
		}
		out.sort((a, b) => {
			if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
			const d = a.start.getTime() - b.start.getTime();
			if (d !== 0) return d;
			return b.end.getTime() - a.end.getTime();
		});
		return out;
	}

	getOccurrencesForDay(day: Date, hidden?: Set<string>): CalendarOccurrence[] {
		const s = startOfDay(day);
		return this.getOccurrences(s, addDays(s, 1), hidden);
	}

	// ---------------------------------------------------------------- external calendars

	private cachePath(id: string): string {
		return normalizePath(`${this.plugin.manifest.dir}/cache/${id}.ics`);
	}

	/** Load previously downloaded ICS data so calendars are available offline / instantly. */
	async loadCached(): Promise<void> {
		const adapter = this.plugin.app.vault.adapter;
		for (const s of this.settings.sources) {
			if (s.type !== "ics") continue;
			const path = this.cachePath(s.id);
			try {
				if (await adapter.exists(path)) {
					const raw = await adapter.read(path);
					this.ics.set(s.id, new IcsCalendar(s, raw));
					this.status.set(s.id, { ...this.status.get(s.id), eventCount: this.ics.get(s.id)?.eventCount });
				}
			} catch (e) {
				console.warn("Omni Calendar: failed to load cached calendar", s.name, e);
			}
		}
		this.notify();
	}

	private async saveCache(id: string, raw: string) {
		const adapter = this.plugin.app.vault.adapter;
		const dir = normalizePath(`${this.plugin.manifest.dir}/cache`);
		try {
			if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
			await adapter.write(this.cachePath(id), raw);
		} catch (e) {
			console.warn("Omni Calendar: could not write cache", e);
		}
	}

	async removeCache(id: string) {
		this.ics.delete(id);
		this.status.delete(id);
		const adapter = this.plugin.app.vault.adapter;
		try {
			const p = this.cachePath(id);
			if (await adapter.exists(p)) await adapter.remove(p);
		} catch {
			/* ignore */
		}
	}

	private async fetchRaw(source: CalendarSource): Promise<string> {
		const url = (source.url ?? "").trim();
		if (!url) throw new Error("No URL configured");
		const hint = wrongLinkHint(url);
		if (hint) throw new Error(hint);
		if (isRemoteUrl(url)) {
			const res = await requestUrl({
				url: normalizeIcsUrl(url),
				method: "GET",
				headers: { Accept: "text/calendar, text/plain, */*" },
				throw: false,
			});
			if (res.status < 200 || res.status >= 300) throw new Error(httpErrorMessage(res.status, url));
			return res.text;
		}
		const file = this.plugin.app.vault.getAbstractFileByPath(normalizePath(url));
		if (!(file instanceof TFile)) throw new Error(`File not found in vault: ${url}`);
		return this.plugin.app.vault.read(file);
	}

	isRemoteSource(source: CalendarSource): boolean {
		return source.type === "google" || source.type === "outlook";
	}

	/** Writable Google / Outlook calendars whose account is signed in on this device. */
	writableRemoteSources(): CalendarSource[] {
		return this.settings.sources.filter((s) => {
			if (!this.isRemoteSource(s) || s.readOnly || !s.enabled) return false;
			const acc = this.plugin.accounts.getAccount(s.accountId);
			return !!acc && this.plugin.accounts.isSignedIn(acc);
		});
	}

	/** Remote fetch window: 6 months back, 18 months ahead. */
	private remoteWindow(): { from: Date; to: Date } {
		const today = startOfDay(new Date());
		return { from: addMonths(today, -6), to: addMonths(today, 18) };
	}

	private async refreshRemote(source: CalendarSource): Promise<void> {
		const account = this.plugin.accounts.getAccount(source.accountId);
		if (!account) throw new Error("The account for this calendar was removed.");
		if (!this.plugin.accounts.isSignedIn(account)) throw new Error("Not signed in on this device – open settings and sign in.");
		const { from, to } = this.remoteWindow();
		const events = await providerFor(account.provider).listEvents(this.plugin.accounts.tokenGetter(account), source.remoteId as string, from, to);
		this.remote.set(source.id, events);
		this.status.set(source.id, { lastFetched: Date.now(), eventCount: events.length, loading: false });
	}

	forgetRemote(sourceId: string) {
		this.remote.delete(sourceId);
		this.status.delete(sourceId);
	}

	// ---------------------------------------------------------------- remote writes

	private remoteContext(source: CalendarSource) {
		const account = this.plugin.accounts.getAccount(source.accountId);
		if (!account || !source.remoteId) throw new Error("This calendar is not connected.");
		if (source.readOnly) throw new Error("You only have read access to this calendar.");
		return { account, provider: providerFor(account.provider), token: this.plugin.accounts.tokenGetter(account), calId: source.remoteId };
	}

	private async afterWrite(source: CalendarSource, err?: unknown) {
		await this.refreshSource(source);
		if (err) throw err;
	}

	async createRemote(source: CalendarSource, input: EventInput): Promise<void> {
		const c = this.remoteContext(source);
		let err: unknown;
		try {
			await c.provider.createEvent(c.token, c.calId, input);
		} catch (e) {
			err = e;
		}
		await this.afterWrite(source, err);
	}

	async updateRemote(occ: CalendarOccurrence, input: EventInput): Promise<void> {
		const source = this.getSource(occ.sourceId);
		if (!source || !occ.remote) throw new Error("Event not found.");
		const c = this.remoteContext(source);
		let err: unknown;
		try {
			await c.provider.updateEvent(c.token, c.calId, occ.remote.id, { ...input, recurrence: undefined }, occ.remote.etag);
		} catch (e) {
			err = e;
		}
		await this.afterWrite(source, err);
	}

	/** Delete one occurrence, or the whole series when `series` is true. */
	async deleteRemote(occ: CalendarOccurrence, series = false): Promise<void> {
		const source = this.getSource(occ.sourceId);
		if (!source || !occ.remote) throw new Error("Event not found.");
		const c = this.remoteContext(source);
		const target = series && occ.remote.seriesId ? occ.remote.seriesId : occ.remote.id;
		let err: unknown;
		try {
			await c.provider.deleteEvent(c.token, c.calId, target, target === occ.remote.id ? occ.remote.etag : undefined);
		} catch (e) {
			// Already gone remotely – treat as success.
			if (!(e instanceof ApiError && (e.status === 404 || e.status === 410))) err = e;
		}
		await this.afterWrite(source, err);
	}

	/** Move an event (drag & drop). Works for local events and writable remote events. */
	async moveOccurrence(occ: CalendarOccurrence, start: Date, end: Date): Promise<void> {
		if (occ.remote) {
			await this.updateRemote(occ, {
				title: occ.title, allDay: occ.allDay, start, end, location: occ.location, description: occ.description,
			});
			return;
		}
		if (!occ.eventId) return;
		if (occ.allDay) {
			await this.updateEvent(occ.eventId, { start: toDateKey(start), end: toDateKey(addDays(end, -1)) });
		} else {
			const k = (d: Date) => `${toDateKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
			await this.updateEvent(occ.eventId, { start: k(start), end: k(end) });
		}
	}

	async refreshSource(source: CalendarSource): Promise<void> {
		if (this.isRemoteSource(source)) {
			this.status.set(source.id, { ...this.status.get(source.id), loading: true, error: undefined });
			this.notify();
			try {
				await this.refreshRemote(source);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				console.error(`Omni Calendar: failed to refresh "${source.name}": ${msg}`);
				this.status.set(source.id, { ...this.status.get(source.id), loading: false, error: msg });
			}
			this.notify();
			return;
		}
		if (source.type !== "ics") return;
		this.status.set(source.id, { ...this.status.get(source.id), loading: true, error: undefined });
		this.notify();
		try {
			const raw = await this.fetchRaw(source);
			if (!/BEGIN:VCALENDAR/i.test(raw)) {
				throw new Error("Response is not an iCalendar (.ics) file. Check that you used the ICS / iCal link.");
			}
			const cal = new IcsCalendar(source, raw);
			this.ics.set(source.id, cal);
			this.status.set(source.id, { lastFetched: Date.now(), eventCount: cal.eventCount, loading: false });
			if (isRemoteUrl(source.url ?? "")) await this.saveCache(source.id, raw);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error(`Omni Calendar: failed to refresh "${source.name}"`, e);
			this.status.set(source.id, { ...this.status.get(source.id), loading: false, error: msg });
		}
		this.notify();
	}

	async refreshAll(): Promise<void> {
		await Promise.all(this.settings.sources.filter((s) => s.type !== "local" && s.enabled).map((s) => this.refreshSource(s)));
	}

	/** Default start/end for a new event on a given day / time. */
	defaultTimes(day: Date, hour?: number, minute = 0): { start: Date; end: Date } {
		const now = new Date();
		const h = hour ?? (dayDiff(now, day) === 0 ? Math.min(now.getHours() + 1, 23) : 9);
		const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, minute);
		return { start, end: addMinutes(start, this.settings.defaultEventDuration) };
	}
}

/** Detect links that point to a calendar web page instead of an ICS feed. */
export function wrongLinkHint(url: string): string | null {
	const u = url.toLowerCase();
	if (u.includes("calendar.google.com") && !u.includes("/ical/")) {
		return "This is a Google Calendar web page link, not the ICS feed. In Google Calendar settings open the calendar → \"Integrate calendar\" → copy \"Secret address in iCal format\" (it ends in .ics).";
	}
	if ((u.includes("outlook.live.com") || u.includes("outlook.office")) && !u.includes(".ics") && !u.includes("/owa/calendar/")) {
		return "This looks like an Outlook web page link. Use Settings → Calendar → Shared calendars → \"Publish a calendar\" and copy the ICS link.";
	}
	return null;
}

function httpErrorMessage(status: number, url: string): string {
	const u = url.toLowerCase();
	if (status === 401 || status === 403 || status === 404) {
		if (u.includes("calendar.google.com")) {
			if (u.includes("/public/")) {
				return `HTTP ${status}: the public address only works if the calendar is made public. Use \"Secret address in iCal format\" instead.`;
			}
			return `HTTP ${status}: Google rejected the link. Copy \"Secret address in iCal format\" again (Settings → your calendar → Integrate calendar); it changes if it was reset.`;
		}
		return `HTTP ${status}: access denied – the link is private, expired or not an ICS feed. Copy the calendar's ICS / iCal share link again.`;
	}
	return `HTTP ${status}`;
}
