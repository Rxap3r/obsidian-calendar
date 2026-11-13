import { Events, normalizePath, requestUrl, TFile } from "obsidian";
import type OmniCalendarPlugin from "./main";
import { CalendarOccurrence, CalendarSource, LocalEvent, SourceStatus } from "./types";
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
		if (isRemoteUrl(url)) {
			const res = await requestUrl({
				url: normalizeIcsUrl(url),
				method: "GET",
				headers: { Accept: "text/calendar, text/plain, */*" },
				throw: false,
			});
			if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
			return res.text;
		}
		const file = this.plugin.app.vault.getAbstractFileByPath(normalizePath(url));
		if (!(file instanceof TFile)) throw new Error(`File not found in vault: ${url}`);
		return this.plugin.app.vault.read(file);
	}

	async refreshSource(source: CalendarSource): Promise<void> {
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
		await Promise.all(this.settings.sources.filter((s) => s.type === "ics" && s.enabled).map((s) => this.refreshSource(s)));
	}

	/** Default start/end for a new event on a given day / time. */
	defaultTimes(day: Date, hour?: number, minute = 0): { start: Date; end: Date } {
		const now = new Date();
		const h = hour ?? (dayDiff(now, day) === 0 ? Math.min(now.getHours() + 1, 23) : 9);
		const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, minute);
		return { start, end: addMinutes(start, this.settings.defaultEventDuration) };
	}
}
