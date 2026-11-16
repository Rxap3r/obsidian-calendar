import { CalendarOccurrence } from "../../types";
import { MS_MIN } from "../../dateUtils";

/** Height of one hour in the week / day view, in pixels. */
export const HOUR_HEIGHT = 48;
/** Times picked with the mouse or finger snap to this many minutes. */
export const SNAP_MIN = 15;
/** Below this width per day the month grid becomes the compact grid (title bars). */
const MONTH_MIN_CELL = 62;
/** Below this width per day the compact grid shows dots instead of title bars. */
const MONTH_BARS_MIN_CELL = 44;
/** Minimum width of a day column in the week view; fewer days are shown below it. */
const WEEK_MIN_COL = 74;
/** Width of the hour-label column in the week / day view. */
const GUTTER = 56;
/** Hour-label column width in the horizontally scrolling week view (must match styles.css). */
export const HSCROLL_GUTTER = 44;

export type MonthLayout = "full" | "bars" | "dots";

/** Month layout for a view of this width: full grid, compact grid with title bars, or with dots. */
export function monthLayout(width: number, showWeekNumbers: boolean): MonthLayout {
	if (!width) return "full";
	const cell = (width - (showWeekNumbers ? 24 : 0)) / 7;
	if (cell >= MONTH_MIN_CELL) return "full";
	return cell >= MONTH_BARS_MIN_CELL ? "bars" : "dots";
}

/** How many days fit side by side in the week view (1–7). */
export function weekDayCount(width: number): number {
	if (!width) return 7;
	return Math.max(1, Math.min(7, Math.floor((width - GUTTER) / WEEK_MIN_COL)));
}

/** Minutes after midnight for a vertical position inside a day column, limited to the day. */
export function minutesAt(col: HTMLElement, clientY: number, round: (n: number) => number, offsetMin = 0): number {
	const rect = col.getBoundingClientRect();
	const m = ((clientY - rect.top) / HOUR_HEIGHT) * 60 - offsetMin;
	return Math.max(0, Math.min(24 * 60 - SNAP_MIN, round(m / SNAP_MIN) * SNAP_MIN));
}

/** Assign side-by-side columns to overlapping timed events. */
export function layoutColumns(occs: CalendarOccurrence[], dayStart: Date, dayEnd: Date) {
	const items = occs
		.map((occ) => ({
			occ,
			s: Math.max(occ.start.getTime(), dayStart.getTime()),
			e: Math.max(Math.min(occ.end.getTime(), dayEnd.getTime()), Math.max(occ.start.getTime(), dayStart.getTime()) + 20 * MS_MIN),
			colIdx: 0,
			colCount: 1,
		}))
		.sort((a, b) => a.s - b.s || b.e - a.e);
	let cluster: typeof items = [];
	let clusterEnd = -Infinity;
	const flush = () => {
		const colEnds: number[] = [];
		for (const it of cluster) {
			let idx = colEnds.findIndex((end) => end <= it.s);
			if (idx === -1) {
				idx = colEnds.length;
				colEnds.push(it.e);
			} else colEnds[idx] = it.e;
			it.colIdx = idx;
		}
		for (const it of cluster) it.colCount = colEnds.length;
		cluster = [];
	};
	for (const it of items) {
		if (it.s >= clusterEnd && cluster.length) flush();
		cluster.push(it);
		clusterEnd = Math.max(clusterEnd === -Infinity ? it.e : clusterEnd, it.e);
		if (cluster.length === 1) clusterEnd = it.e;
	}
	if (cluster.length) flush();
	return items;
}
