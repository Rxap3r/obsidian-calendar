/** Small, dependency-free date helpers. All functions work in local time. */

export const MS_MIN = 60 * 1000;
export const MS_HOUR = 60 * MS_MIN;
export const MS_DAY = 24 * MS_HOUR;

const pad = (n: number) => String(n).padStart(2, "0");

export function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
	const r = new Date(d);
	r.setDate(r.getDate() + n);
	return r;
}

export function addMonths(d: Date, n: number): Date {
	const day = d.getDate();
	const r = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), d.getSeconds());
	const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
	r.setDate(Math.min(day, last));
	return r;
}

export function addMinutes(d: Date, n: number): Date {
	return new Date(d.getTime() + n * MS_MIN);
}

export function startOfWeek(d: Date, firstDay: number): Date {
	const s = startOfDay(d);
	const diff = (s.getDay() - firstDay + 7) % 7;
	return addDays(s, -diff);
}

export function startOfMonth(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function isSameDay(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Number of calendar days between two dates (b - a), DST-safe. */
export function dayDiff(a: Date, b: Date): number {
	const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
	const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
	return Math.round((ub - ua) / MS_DAY);
}

export function toDateKey(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeKey(d: Date): string {
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateTimeKey(d: Date): string {
	return `${toDateKey(d)}T${toTimeKey(d)}`;
}

/** Parse "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm[:ss]" as local time. */
export function parseLocal(s: string): Date {
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s.trim());
	if (!m) return new Date(NaN);
	return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0);
}

export function isValidDate(d: Date): boolean {
	return d instanceof Date && !isNaN(d.getTime());
}

/** ISO-8601 week number. */
export function isoWeek(d: Date): number {
	const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const day = t.getUTCDay() || 7;
	t.setUTCDate(t.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
	return Math.ceil(((t.getTime() - yearStart.getTime()) / MS_DAY + 1) / 7);
}

export function formatTime(d: Date, use24h: boolean): string {
	if (use24h) return toTimeKey(d);
	let h = d.getHours();
	const m = d.getMinutes();
	const ap = h >= 12 ? "pm" : "am";
	h = h % 12 || 12;
	return m === 0 ? `${h}${ap}` : `${h}:${pad(m)}${ap}`;
}

export function formatHour(h: number, use24h: boolean): string {
	if (use24h) return `${pad(h)}:00`;
	const ap = h >= 12 ? "pm" : "am";
	return `${h % 12 || 12} ${ap}`;
}

export function formatDate(d: Date, opts: Intl.DateTimeFormatOptions): string {
	return d.toLocaleDateString(undefined, opts);
}

export function weekdayNames(firstDay: number, style: "short" | "narrow" | "long" = "short"): string[] {
	const base = new Date(2024, 0, 7); // a Sunday
	const names: string[] = [];
	for (let i = 0; i < 7; i++) {
		names.push(addDays(base, (firstDay + i) % 7).toLocaleDateString(undefined, { weekday: style }));
	}
	return names;
}

/** Does the occurrence [start, end) overlap the given day? */
export function overlapsDay(start: Date, end: Date, day: Date): boolean {
	const ds = startOfDay(day);
	const de = addDays(ds, 1);
	if (end.getTime() === start.getTime()) return start >= ds && start < de;
	return start < de && end > ds;
}

export function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Convert a wall-clock time in an IANA time zone to an absolute Date. */
export function zonedTimeToDate(
	y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string
): Date | null {
	try {
		const fmt = new Intl.DateTimeFormat("en-US", {
			timeZone, hourCycle: "h23",
			year: "numeric", month: "2-digit", day: "2-digit",
			hour: "2-digit", minute: "2-digit", second: "2-digit",
		});
		const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
		const offsetAt = (t: number) => {
			const parts: Record<string, number> = {};
			for (const p of fmt.formatToParts(new Date(t))) {
				if (p.type !== "literal") parts[p.type] = parseInt(p.value, 10);
			}
			const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
			return wall - t;
		};
		let guess = asUtc - offsetAt(asUtc);
		guess = asUtc - offsetAt(guess);
		return new Date(guess);
	} catch {
		return null;
	}
}
