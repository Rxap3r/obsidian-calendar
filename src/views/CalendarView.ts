import { ItemView, Menu, Notice, setIcon, ViewStateResult, WorkspaceLeaf } from "obsidian";
import type CalendarHubPlugin from "../main";
import { CalendarOccurrence, ViewMode } from "../types";
import {
	addDays, addMinutes, addMonths, dayDiff, formatDate, formatHour, formatTime, isoWeek, isSameDay,
	MS_MIN, overlapsDay, parseLocal, startOfDay, startOfMonth, startOfWeek, toDateKey, toDateTimeKey,
	weekdayNames,
} from "../dateUtils";
import { EventModal } from "../modals/EventModal";
import { createChip, DRAG_MIME, occurrenceMenu, openOccurrence, tooltip } from "./shared";
import { CalendarStore } from "../store";

export const VIEW_TYPE_CALENDAR = "calendar-hub-view";

const HOUR_HEIGHT = 48;
const SNAP_MIN = 15;
const MONTH_MAX_CHIPS = 4;

interface ViewState {
	mode?: ViewMode;
	date?: string;
}

export class CalendarView extends ItemView {
	mode: ViewMode;
	cursor: Date = startOfDay(new Date());
	hidden = new Set<string>();
	private bodyEl!: HTMLElement;
	private titleEl!: HTMLElement;
	private modeButtons: Partial<Record<ViewMode, HTMLElement>> = {};
	private renderQueued = false;
	private nowTimer: number | null = null;
	private scrollTop: number | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: CalendarHubPlugin) {
		super(leaf);
		this.mode = plugin.settings.defaultView;
	}

	getViewType() {
		return VIEW_TYPE_CALENDAR;
	}
	getDisplayText() {
		return "Calendar";
	}
	getIcon() {
		return "calendar-days";
	}

	getState(): Record<string, unknown> {
		return { mode: this.mode, date: toDateKey(this.cursor) };
	}

	async setState(state: ViewState, result: ViewStateResult): Promise<void> {
		if (state?.mode) this.mode = state.mode;
		if (state?.date) {
			const d = parseLocal(state.date);
			if (!isNaN(d.getTime())) this.cursor = d;
		}
		this.render();
		await super.setState(state, result);
	}

	async onOpen() {
		this.contentEl.empty();
		this.contentEl.addClass("ch-view");
		this.buildToolbar();
		this.bodyEl = this.contentEl.createDiv({ cls: "ch-body" });
		this.registerEvent(this.plugin.store.on("changed", () => this.queueRender()));
		this.nowTimer = window.setInterval(() => this.updateNowLine(), 60 * 1000);
		this.registerInterval(this.nowTimer);
		this.render();
	}

	async onClose() {
		this.contentEl.empty();
	}

	/** Navigate to a date and (optionally) a view mode. */
	goTo(date: Date, mode?: ViewMode) {
		this.cursor = startOfDay(date);
		if (mode) this.mode = mode;
		this.scrollTop = null;
		this.render();
		this.app.workspace.requestSaveLayout();
	}

	private queueRender() {
		if (this.renderQueued) return;
		this.renderQueued = true;
		window.requestAnimationFrame(() => {
			this.renderQueued = false;
			this.render();
		});
	}

	// ------------------------------------------------------------------ toolbar

	private buildToolbar() {
		const bar = this.contentEl.createDiv({ cls: "ch-toolbar" });
		const nav = bar.createDiv({ cls: "ch-toolbar-group" });
		const prev = nav.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Previous" } });
		setIcon(prev, "chevron-left");
		prev.onclick = () => this.step(-1);
		const today = nav.createEl("button", { text: "Today", cls: "ch-today-btn" });
		today.onclick = () => this.goTo(new Date());
		const next = nav.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Next" } });
		setIcon(next, "chevron-right");
		next.onclick = () => this.step(1);
		this.titleEl = bar.createDiv({ cls: "ch-title" });

		const right = bar.createDiv({ cls: "ch-toolbar-group ch-toolbar-right" });
		const modes = right.createDiv({ cls: "ch-segmented" });
		const labels: Record<ViewMode, string> = { month: "Month", week: "Week", day: "Day", agenda: "Agenda" };
		(Object.keys(labels) as ViewMode[]).forEach((m) => {
			const b = modes.createEl("button", { text: labels[m] });
			b.onclick = () => {
				this.mode = m;
				this.render();
				this.app.workspace.requestSaveLayout();
			};
			this.modeButtons[m] = b;
		});

		const filter = right.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Show / hide calendars" } });
		setIcon(filter, "filter");
		filter.onclick = (e) => this.showFilterMenu(e);

		const refresh = right.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Refresh external calendars" } });
		setIcon(refresh, "refresh-cw");
		refresh.onclick = async () => {
			refresh.addClass("ch-spin");
			await this.plugin.store.refreshAll();
			refresh.removeClass("ch-spin");
			const errors = [...this.plugin.store.status.values()].filter((s) => s.error).length;
			new Notice(errors ? `Calendars refreshed – ${errors} failed (see settings)` : "Calendars refreshed");
		};

		const add = right.createEl("button", { cls: "mod-cta ch-new-btn", attr: { "aria-label": "New event" } });
		setIcon(add.createSpan(), "plus");
		add.createSpan({ text: "New", cls: "ch-new-label" });
		add.onclick = () => new EventModal(this.plugin, { start: this.cursor }).open();
	}

	private showFilterMenu(e: MouseEvent) {
		const menu = new Menu();
		for (const s of this.plugin.settings.sources) {
			if (!s.enabled) continue;
			menu.addItem((i) =>
				i
					.setTitle(s.name)
					.setChecked(!this.hidden.has(s.id))
					.onClick(() => {
						if (this.hidden.has(s.id)) this.hidden.delete(s.id);
						else this.hidden.add(s.id);
						this.render();
					})
			);
		}
		menu.addSeparator();
		menu.addItem((i) => i.setTitle("Manage calendars…").setIcon("settings").onClick(() => this.plugin.openSettings()));
		menu.showAtMouseEvent(e);
	}

	private step(dir: number) {
		switch (this.mode) {
			case "month": this.cursor = addMonths(startOfMonth(this.cursor), dir); break;
			case "week": this.cursor = addDays(this.cursor, 7 * dir); break;
			case "day": this.cursor = addDays(this.cursor, dir); break;
			case "agenda": this.cursor = addDays(this.cursor, this.plugin.settings.agendaDays * dir); break;
		}
		this.render();
		this.app.workspace.requestSaveLayout();
	}

	// ------------------------------------------------------------------ render

	render() {
		if (!this.bodyEl) return;
		const keepScroll = this.bodyEl.querySelector(".ch-grid-scroll");
		if (keepScroll) this.scrollTop = keepScroll.scrollTop;

		for (const [m, b] of Object.entries(this.modeButtons)) b?.toggleClass("is-active", m === this.mode);
		this.bodyEl.empty();
		this.bodyEl.className = `ch-body ch-mode-${this.mode}`;
		switch (this.mode) {
			case "month": this.renderMonth(); break;
			case "week": this.renderTimeGrid(startOfWeek(this.cursor, this.plugin.settings.firstDayOfWeek), 7); break;
			case "day": this.renderTimeGrid(this.cursor, 1); break;
			case "agenda": this.renderAgenda(); break;
		}
	}

	private renderMonth() {
		const s = this.plugin.settings;
		const monthStart = startOfMonth(this.cursor);
		this.titleEl.setText(formatDate(monthStart, { month: "long", year: "numeric" }));
		const gridStart = startOfWeek(monthStart, s.firstDayOfWeek);
		const gridEnd = addDays(gridStart, 42);
		const occs = this.plugin.store.getOccurrences(gridStart, gridEnd, this.hidden);
		const today = new Date();

		const wrap = this.bodyEl.createDiv({ cls: "ch-month" });
		if (s.showWeekNumbers) wrap.addClass("ch-with-weeknums");
		const head = wrap.createDiv({ cls: "ch-month-head" });
		if (s.showWeekNumbers) head.createDiv({ cls: "ch-weeknum-head", text: "W" });
		for (const n of weekdayNames(s.firstDayOfWeek)) head.createDiv({ cls: "ch-weekday", text: n });

		const grid = wrap.createDiv({ cls: "ch-month-grid" });
		for (let w = 0; w < 6; w++) {
			const row = grid.createDiv({ cls: "ch-month-row" });
			if (s.showWeekNumbers) row.createDiv({ cls: "ch-weeknum", text: String(isoWeek(addDays(gridStart, w * 7 + 3))) });
			for (let d = 0; d < 7; d++) {
				const day = addDays(gridStart, w * 7 + d);
				const cell = row.createDiv({ cls: "ch-month-cell" });
				if (day.getMonth() !== monthStart.getMonth()) cell.addClass("ch-other-month");
				if (isSameDay(day, today)) cell.addClass("ch-today");
				const dow = day.getDay();
				if (dow === 0 || dow === 6) cell.addClass("ch-weekend");

				const header = cell.createDiv({ cls: "ch-cell-head" });
				const num = header.createSpan({ cls: "ch-day-num", text: String(day.getDate()) });
				num.onclick = (e) => {
					e.stopPropagation();
					this.goTo(day, "day");
				};
				const plus = header.createSpan({ cls: "ch-cell-add", attr: { "aria-label": "New event" } });
				setIcon(plus, "plus");
				plus.onclick = (e) => {
					e.stopPropagation();
					new EventModal(this.plugin, { start: day }).open();
				};

				const list = cell.createDiv({ cls: "ch-cell-events" });
				const dayOccs = occs.filter((o) => overlapsDay(o.start, o.end, day));
				const shown = dayOccs.length > MONTH_MAX_CHIPS ? MONTH_MAX_CHIPS - 1 : MONTH_MAX_CHIPS;
				dayOccs.slice(0, shown).forEach((o) => {
					const chip = createChip(this.plugin, list, o, { showTime: true, draggable: true });
					if (o.allDay && !isSameDay(o.start, day)) chip.addClass("ch-continued");
				});
				if (dayOccs.length > shown) {
					const more = list.createDiv({ cls: "ch-more", text: `+${dayOccs.length - shown} more` });
					more.onclick = (e) => {
						e.stopPropagation();
						this.goTo(day, "day");
					};
				}
				cell.addEventListener("dblclick", () => new EventModal(this.plugin, { start: day }).open());
				this.makeDayDropTarget(cell, day, null);
			}
		}
	}

	/** Accept dropped local events on a day (month cell / all-day row) or a time column. */
	private makeDayDropTarget(el: HTMLElement, day: Date, timeFromEvent: ((e: DragEvent) => number) | null) {
		el.addEventListener("dragover", (e) => {
			if (!e.dataTransfer?.types.includes(DRAG_MIME)) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			el.addClass("ch-drop-target");
		});
		el.addEventListener("dragleave", () => el.removeClass("ch-drop-target"));
		el.addEventListener("drop", async (e) => {
			el.removeClass("ch-drop-target");
			const id = e.dataTransfer?.getData(DRAG_MIME);
			if (!id) return;
			e.preventDefault();
			const ev = this.plugin.store.getEvent(id);
			if (!ev) return;
			const { start, end } = CalendarStore.bounds(ev);
			const dur = end.getTime() - start.getTime();
			if (ev.allDay) {
				const shift = dayDiff(start, day);
				const lastDay = addDays(end, -1);
				await this.plugin.store.updateEvent(id, { start: toDateKey(addDays(start, shift)), end: toDateKey(addDays(lastDay, shift)) });
				return;
			}
			let ns: Date;
			if (timeFromEvent) {
				ns = addMinutes(startOfDay(day), timeFromEvent(e));
			} else {
				ns = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.getHours(), start.getMinutes());
			}
			await this.plugin.store.updateEvent(id, { start: toDateTimeKey(ns), end: toDateTimeKey(new Date(ns.getTime() + dur)) });
		});
	}

	private renderTimeGrid(first: Date, days: number) {
		const s = this.plugin.settings;
		const last = addDays(first, days - 1);
		if (days === 1) {
			this.titleEl.setText(formatDate(first, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
		} else if (first.getMonth() === last.getMonth()) {
			this.titleEl.setText(`${formatDate(first, { month: "long", year: "numeric" })} · W${isoWeek(addDays(first, 3))}`);
		} else {
			this.titleEl.setText(
				`${formatDate(first, { month: "short" })} – ${formatDate(last, { month: "short", year: "numeric" })} · W${isoWeek(addDays(first, 3))}`
			);
		}
		const occs = this.plugin.store.getOccurrences(first, addDays(first, days), this.hidden);
		const allDay = occs.filter((o) => o.allDay || o.end.getTime() - o.start.getTime() >= 24 * 60 * MS_MIN);
		const timed = occs.filter((o) => !allDay.includes(o));
		const today = new Date();

		const wrap = this.bodyEl.createDiv({ cls: "ch-timegrid" });
		wrap.style.setProperty("--ch-days", String(days));

		// Day headers
		const head = wrap.createDiv({ cls: "ch-tg-head" });
		head.createDiv({ cls: "ch-tg-gutter" });
		for (let i = 0; i < days; i++) {
			const day = addDays(first, i);
			const h = head.createDiv({ cls: "ch-tg-dayhead" });
			if (isSameDay(day, today)) h.addClass("ch-today");
			h.createSpan({ cls: "ch-tg-dow", text: formatDate(day, { weekday: "short" }) });
			h.createSpan({ cls: "ch-tg-date", text: String(day.getDate()) });
			if (days > 1) h.onclick = () => this.goTo(day, "day");
		}

		// All-day row
		const adRow = wrap.createDiv({ cls: "ch-tg-allday" });
		adRow.createDiv({ cls: "ch-tg-gutter ch-tg-allday-label", text: "all-day" });
		for (let i = 0; i < days; i++) {
			const day = addDays(first, i);
			const cell = adRow.createDiv({ cls: "ch-tg-allday-cell" });
			for (const o of allDay.filter((x) => overlapsDay(x.start, x.end, day))) {
				const chip = createChip(this.plugin, cell, o, { draggable: true });
				if (!isSameDay(o.start, day)) chip.addClass("ch-continued");
			}
			cell.addEventListener("dblclick", () => new EventModal(this.plugin, { start: day, allDay: true }).open());
			this.makeDayDropTarget(cell, day, null);
		}

		// Scrollable hour grid
		const scroll = wrap.createDiv({ cls: "ch-grid-scroll" });
		const inner = scroll.createDiv({ cls: "ch-tg-inner" });
		inner.style.height = `${HOUR_HEIGHT * 24}px`;
		const gutter = inner.createDiv({ cls: "ch-tg-gutter ch-tg-hours" });
		for (let h = 0; h < 24; h++) {
			const lbl = gutter.createDiv({ cls: "ch-tg-hour-label", text: h === 0 ? "" : formatHour(h, s.use24h) });
			lbl.style.top = `${h * HOUR_HEIGHT}px`;
		}
		const cols = inner.createDiv({ cls: "ch-tg-cols" });
		for (let i = 0; i < days; i++) {
			const day = addDays(first, i);
			const col = cols.createDiv({ cls: "ch-tg-col" });
			col.dataset.date = toDateKey(day);
			if (isSameDay(day, today)) col.addClass("ch-today");
			for (let h = 0; h < 24; h++) {
				col.createDiv({ cls: "ch-tg-hourline" }).style.top = `${h * HOUR_HEIGHT}px`;
			}
			const minutesFromY = (clientY: number) => {
				const rect = col.getBoundingClientRect();
				const m = ((clientY - rect.top) / HOUR_HEIGHT) * 60;
				return Math.max(0, Math.min(24 * 60 - SNAP_MIN, Math.floor(m / SNAP_MIN) * SNAP_MIN));
			};
			this.enableSlotSelection(col, day, minutesFromY);
			this.makeDayDropTarget(col, day, (e) => minutesFromY(e.clientY));

			const dayStart = startOfDay(day);
			const dayEnd = addDays(dayStart, 1);
			const dayOccs = timed.filter((o) => overlapsDay(o.start, o.end, day));
			for (const { occ, colIdx, colCount } of layoutColumns(dayOccs, dayStart, dayEnd)) {
				const segStart = occ.start < dayStart ? dayStart : occ.start;
				const segEnd = occ.end > dayEnd ? dayEnd : occ.end;
				const top = ((segStart.getTime() - dayStart.getTime()) / (60 * MS_MIN)) * HOUR_HEIGHT;
				const height = Math.max(((segEnd.getTime() - segStart.getTime()) / (60 * MS_MIN)) * HOUR_HEIGHT, 18);
				const el = col.createDiv({ cls: "ch-tg-event" });
				el.style.setProperty("--ch-event-color", occ.color);
				el.style.top = `${top}px`;
				el.style.height = `${height - 2}px`;
				el.style.left = `calc(${(colIdx / colCount) * 100}% + 1px)`;
				el.style.width = `calc(${(1 / colCount) * 100}% - 3px)`;
				if (occ.readOnly) el.addClass("ch-readonly");
				if (occ.end < today) el.addClass("ch-past");
				if (height < 36) el.addClass("ch-compact");
				el.createDiv({ cls: "ch-tg-event-title", text: occ.title });
				el.createDiv({
					cls: "ch-tg-event-time",
					text: `${formatTime(occ.start, s.use24h)} – ${formatTime(occ.end, s.use24h)}${occ.location ? ` · ${occ.location}` : ""}`,
				});
				el.setAttr("title", tooltip(this.plugin, occ));
				el.addEventListener("pointerdown", (e) => e.stopPropagation());
				el.addEventListener("click", (e) => {
					e.stopPropagation();
					openOccurrence(this.plugin, occ);
				});
				el.addEventListener("contextmenu", (e) => {
					e.preventDefault();
					e.stopPropagation();
					occurrenceMenu(this.plugin, occ, e);
				});
				if (!occ.readOnly && !occ.recurring && occ.eventId) {
					el.draggable = true;
					el.addEventListener("dragstart", (e) => {
						e.dataTransfer?.setData(DRAG_MIME, occ.eventId as string);
						el.addClass("ch-dragging");
					});
					el.addEventListener("dragend", () => el.removeClass("ch-dragging"));
				}
			}
		}
		this.updateNowLine();

		// Restore or set initial scroll position.
		window.requestAnimationFrame(() => {
			// Align the header columns with the scrollable body (scrollbar width).
			wrap.style.setProperty("--ch-scrollbar", `${scroll.offsetWidth - scroll.clientWidth}px`);
			if (this.scrollTop !== null) {
				scroll.scrollTop = this.scrollTop;
			} else {
				const h = days <= 7 && dayDiff(first, today) >= 0 && dayDiff(first, today) < days ? Math.max(0, today.getHours() - 2) : s.scrollToHour;
				scroll.scrollTop = h * HOUR_HEIGHT;
				this.scrollTop = scroll.scrollTop;
			}
		});
		scroll.addEventListener("scroll", () => (this.scrollTop = scroll.scrollTop));
	}

	/** Click or drag on an empty time slot to create an event. */
	private enableSlotSelection(col: HTMLElement, day: Date, minutesFromY: (y: number) => number) {
		col.addEventListener("pointerdown", (down) => {
			if (down.button !== 0) return;
			const startMin = minutesFromY(down.clientY);
			let endMin = startMin + SNAP_MIN;
			let moved = false;
			const ghost = col.createDiv({ cls: "ch-tg-selection" });
			const draw = () => {
				const a = Math.min(startMin, endMin);
				const b = Math.max(startMin + SNAP_MIN, endMin);
				ghost.style.top = `${(a / 60) * HOUR_HEIGHT}px`;
				ghost.style.height = `${((b - a) / 60) * HOUR_HEIGHT}px`;
			};
			draw();
			const move = (e: PointerEvent) => {
				const m = minutesFromY(e.clientY) + SNAP_MIN;
				if (m !== endMin) {
					endMin = m;
					moved = true;
					draw();
				}
			};
			const up = () => {
				window.removeEventListener("pointermove", move);
				window.removeEventListener("pointerup", up);
				ghost.remove();
				const a = Math.min(startMin, endMin - SNAP_MIN);
				const start = addMinutes(startOfDay(day), a);
				const end = moved
					? addMinutes(startOfDay(day), Math.max(startMin + SNAP_MIN, endMin))
					: addMinutes(start, this.plugin.settings.defaultEventDuration);
				new EventModal(this.plugin, { start, end }).open();
			};
			window.addEventListener("pointermove", move);
			window.addEventListener("pointerup", up);
		});
	}

	private updateNowLine() {
		if (!this.bodyEl) return;
		this.bodyEl.querySelectorAll(".ch-now-line").forEach((n) => n.remove());
		const now = new Date();
		const col = this.bodyEl.querySelector<HTMLElement>(`.ch-tg-col[data-date="${toDateKey(now)}"]`);
		if (!col) return;
		const line = col.createDiv({ cls: "ch-now-line" });
		line.style.top = `${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT}px`;
	}

	private renderAgenda() {
		const s = this.plugin.settings;
		const start = startOfDay(this.cursor);
		const end = addDays(start, s.agendaDays);
		this.titleEl.setText(
			`${formatDate(start, { day: "numeric", month: "short" })} – ${formatDate(addDays(end, -1), { day: "numeric", month: "short", year: "numeric" })}`
		);
		const occs = this.plugin.store.getOccurrences(start, end, this.hidden);
		const wrap = this.bodyEl.createDiv({ cls: "ch-agenda" });
		if (!occs.length) {
			wrap.createDiv({ cls: "ch-empty", text: "No events in this period." });
			return;
		}
		const today = new Date();
		for (let i = 0; i < s.agendaDays; i++) {
			const day = addDays(start, i);
			const dayOccs = occs.filter((o) => overlapsDay(o.start, o.end, day));
			if (!dayOccs.length) continue;
			const group = wrap.createDiv({ cls: "ch-agenda-day" });
			if (isSameDay(day, today)) group.addClass("ch-today");
			const h = group.createDiv({ cls: "ch-agenda-date" });
			h.createSpan({ cls: "ch-agenda-daynum", text: String(day.getDate()) });
			h.createSpan({ cls: "ch-agenda-dayname", text: `${formatDate(day, { weekday: "long" })} · ${formatDate(day, { month: "long", year: "numeric" })}` });
			h.onclick = () => this.goTo(day, "day");
			for (const o of dayOccs) this.agendaItem(group, o, day);
		}
	}

	private agendaItem(parent: HTMLElement, o: CalendarOccurrence, day: Date) {
		const s = this.plugin.settings;
		const row = parent.createDiv({ cls: "ch-agenda-item" });
		row.style.setProperty("--ch-event-color", o.color);
		if (o.end < new Date()) row.addClass("ch-past");
		const time = row.createDiv({ cls: "ch-agenda-time" });
		if (o.allDay) time.setText("All day");
		else {
			const startsToday = isSameDay(o.start, day);
			const endsToday = isSameDay(o.end, day) || o.end.getTime() === addDays(startOfDay(day), 1).getTime();
			time.setText(`${startsToday ? formatTime(o.start, s.use24h) : "…"} – ${endsToday ? formatTime(o.end, s.use24h) : "…"}`);
		}
		row.createSpan({ cls: "ch-dot" });
		const main = row.createDiv({ cls: "ch-agenda-main" });
		main.createDiv({ cls: "ch-agenda-title", text: o.title });
		const sub = [o.location, this.plugin.store.getSource(o.sourceId)?.name].filter(Boolean).join(" · ");
		if (sub) main.createDiv({ cls: "ch-agenda-sub", text: sub });
		row.onclick = () => openOccurrence(this.plugin, o);
		row.oncontextmenu = (e) => {
			e.preventDefault();
			occurrenceMenu(this.plugin, o, e);
		};
	}
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
