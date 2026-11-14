import { ItemView, Menu, Notice, setIcon, ViewStateResult, WorkspaceLeaf } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { CalendarOccurrence, ViewMode } from "../types";
import {
	addDays, addMinutes, addMonths, dayDiff, formatDate, formatHour, formatTime, isoWeek, isSameDay,
	MS_MIN, overlapsDay, parseLocal, startOfDay, startOfMonth, startOfWeek, toDateKey, toDateTimeKey,
	weekdayNames,
} from "../dateUtils";
import { EventModal } from "../modals/EventModal";
import { canDrag, createChip, DRAG_MIME, occurrenceMenu, openOccurrence, tooltip } from "./shared";

export const VIEW_TYPE_CALENDAR = "omni-calendar-view";

const HOUR_HEIGHT = 48;
const SNAP_MIN = 15;
const MONTH_MAX_CHIPS = 4;
/** Below this width per day the month grid becomes a list of day cards. */
const MONTH_MIN_CELL = 62;
/** Minimum width of a day card in the narrow month layout. */
const MONTH_CARD_MIN = 120;
/** Minimum width of a day column in the week view; fewer days are shown below it. */
const WEEK_MIN_COL = 74;
const GUTTER = 56;
/** Hour-label column width in the horizontally scrolling week view (must match styles.css). */
const HSCROLL_GUTTER = 44;
/** Touch: hold this long before dragging selects a time range. */
const LONG_PRESS_MS = 400;
/** Touch: movement (px) that counts as scrolling instead of a tap / long press. */
const TOUCH_SLOP = 8;

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
	private locationBtn: HTMLElement | null = null;
	/** Current width of the view body, used for responsive layouts. */
	private width = 0;
	/** The time-slot selection in progress (at most one). */
	private selection: { cancel: () => void } | null = null;
	private layoutKey = "";
	/** Occurrences currently on screen, by key (used for drag & drop). */
	private rendered = new Map<string, CalendarOccurrence>();

	constructor(leaf: WorkspaceLeaf, private plugin: OmniCalendarPlugin) {
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
		// The view can be dragged between sidebar and main area – keep the button in sync.
		this.registerEvent(this.app.workspace.on("layout-change", () => this.updateLocationButton()));
		// Re-layout when the view is resized (e.g. dragging the sidebar edge).
		const ro = new ResizeObserver(() => this.handleResize());
		ro.observe(this.contentEl);
		this.register(() => ro.disconnect());
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

		this.locationBtn = right.createEl("button", { cls: "ch-icon-btn" });
		this.locationBtn.onclick = () => void this.toggleLocation();
		this.updateLocationButton();

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

	private updateLocationButton() {
		const btn = this.locationBtn;
		if (!btn) return;
		const inSidebar = this.plugin.isInSidebar(this.leaf);
		btn.empty();
		setIcon(btn, inSidebar ? "maximize-2" : "panel-right-open");
		btn.setAttr("aria-label", inSidebar ? "Open full page (keeps this sidebar calendar)" : "Move to sidebar");
		this.contentEl.toggleClass("ch-in-sidebar", inSidebar);
	}

	/** Sidebar → open the full page in the main area. Main area → move this calendar into the sidebar. */
	private async toggleLocation() {
		if (this.plugin.isInSidebar(this.leaf)) {
			await this.plugin.openCalendar(this.cursor, this.mode);
			return;
		}
		await this.plugin.moveToSidebar({ mode: this.mode, date: toDateKey(this.cursor) });
		this.leaf.detach();
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
		this.selection?.cancel();
		if (!this.width) this.width = Math.round(this.bodyEl.clientWidth);
		this.layoutKey = this.computeLayoutKey();
		switch (this.mode) {
			case "month": this.renderMonth(); break;
			case "week":
				// Always the whole week; if not all days fit, it scrolls sideways day by day.
				this.renderTimeGrid(startOfWeek(this.cursor, this.plugin.settings.firstDayOfWeek), 7, this.weekDayCount());
				break;
			case "day": this.renderTimeGrid(this.cursor, 1); break;
			case "agenda": this.renderAgenda(); break;
		}
	}

	// ------------------------------------------------------------------ responsive layout

	/** Called by Obsidian when the view is resized. */
	onResize() {
		this.handleResize();
	}

	private handleResize() {
		const w = Math.round(this.bodyEl?.clientWidth ?? 0);
		if (!w || w === this.width) return;
		this.width = w;
		const key = this.computeLayoutKey();
		if (key !== this.layoutKey) this.queueRender();
		else {
			const wrap = this.bodyEl.querySelector<HTMLElement>(".ch-tg-hscroll");
			if (wrap) this.updateDayWidth(wrap, this.weekDayCount());
		}
	}

	private computeLayoutKey(): string {
		return `${this.monthColumns()}|${this.weekDayCount()}`;
	}

	/** 7 = normal month grid; fewer = day-card layout with that many columns. */
	private monthColumns(): number {
		const w = this.width;
		if (!w) return 7;
		const weekNums = this.plugin.settings.showWeekNumbers ? 32 : 0;
		if (w - weekNums >= 7 * MONTH_MIN_CELL) return 7;
		return Math.max(1, Math.min(4, Math.floor(w / MONTH_CARD_MIN)));
	}

	/** ISO week number of the (configured) week containing this day – same numbering as the month grid. */
	private weekNumber(d: Date): number {
		return isoWeek(addDays(startOfWeek(d, this.plugin.settings.firstDayOfWeek), 3));
	}

	/** How many days fit side by side in the week view (1–7). */
	private weekDayCount(): number {
		const w = this.width;
		if (!w) return 7;
		return Math.max(1, Math.min(7, Math.floor((w - GUTTER) / WEEK_MIN_COL)));
	}

	/** Narrow month layout: the days of the month as cards in a few columns. */
	private renderMonthCards(cols: number) {
		const monthStart = startOfMonth(this.cursor);
		this.titleEl.setText(formatDate(monthStart, { month: "long", year: "numeric" }));
		const monthEnd = addMonths(monthStart, 1);
		const occs = this.plugin.store.getOccurrences(monthStart, monthEnd, this.hidden);
		this.rendered = new Map(occs.map((o) => [o.key, o]));
		const today = new Date();
		const wrap = this.bodyEl.createDiv({ cls: "ch-month-cards" });
		wrap.style.setProperty("--ch-cols", String(cols));
		const showWeeks = this.plugin.settings.showWeekNumbers;
		for (let day = monthStart; day < monthEnd; day = addDays(day, 1)) {
			const d = day;
			// Week number divider at the start of each week (and on the 1st of the month).
			if (showWeeks && (isSameDay(d, monthStart) || d.getDay() === this.plugin.settings.firstDayOfWeek)) {
				wrap.createDiv({ cls: "ch-week-divider", text: `Week ${this.weekNumber(d)}` });
			}
			const card = wrap.createDiv({ cls: "ch-day-card" });
			if (isSameDay(d, today)) card.addClass("ch-today");
			if (d.getDay() === 0 || d.getDay() === 6) card.addClass("ch-weekend");
			const head = card.createDiv({ cls: "ch-day-card-head" });
			head.createSpan({ cls: "ch-day-num", text: String(d.getDate()) });
			head.createSpan({ cls: "ch-day-card-dow", text: formatDate(d, { weekday: "short" }) });
			head.onclick = (e) => {
				e.stopPropagation();
				this.goTo(d, "day");
			};
			const plus = head.createSpan({ cls: "ch-cell-add", attr: { "aria-label": "New event" } });
			setIcon(plus, "plus");
			plus.onclick = (e) => {
				e.stopPropagation();
				new EventModal(this.plugin, { start: d }).open();
			};
			const dayOccs = occs.filter((o) => overlapsDay(o.start, o.end, d));
			if (!dayOccs.length) card.addClass("ch-day-card-empty");
			const list = card.createDiv({ cls: "ch-cell-events" });
			const shown = dayOccs.length > MONTH_MAX_CHIPS ? MONTH_MAX_CHIPS - 1 : MONTH_MAX_CHIPS;
			for (const o of dayOccs.slice(0, shown)) createChip(this.plugin, list, o, { showTime: true, draggable: true });
			if (dayOccs.length > shown) {
				const more = list.createDiv({ cls: "ch-more", text: `+${dayOccs.length - shown} more` });
				more.onclick = (e) => {
					e.stopPropagation();
					this.goTo(d, "day");
				};
			}
			card.addEventListener("dblclick", () => new EventModal(this.plugin, { start: d }).open());
			this.makeDayDropTarget(card, d, null);
		}
	}

	private renderMonth() {
		const cols = this.monthColumns();
		if (cols < 7) {
			this.renderMonthCards(cols);
			return;
		}
		const s = this.plugin.settings;
		const monthStart = startOfMonth(this.cursor);
		this.titleEl.setText(formatDate(monthStart, { month: "long", year: "numeric" }));
		const gridStart = startOfWeek(monthStart, s.firstDayOfWeek);
		const gridEnd = addDays(gridStart, 42);
		const occs = this.plugin.store.getOccurrences(gridStart, gridEnd, this.hidden);
		this.rendered = new Map(occs.map((o) => [o.key, o]));
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
			const key = e.dataTransfer?.getData(DRAG_MIME);
			if (!key) return;
			e.preventDefault();
			const occ = this.rendered.get(key);
			if (!occ) return;
			const dur = occ.end.getTime() - occ.start.getTime();
			let ns: Date;
			if (occ.allDay) {
				ns = addDays(occ.start, dayDiff(occ.start, day));
			} else if (timeFromEvent) {
				ns = addMinutes(startOfDay(day), timeFromEvent(e));
			} else {
				ns = new Date(day.getFullYear(), day.getMonth(), day.getDate(), occ.start.getHours(), occ.start.getMinutes());
			}
			if (ns.getTime() === occ.start.getTime()) return;
			const ne = occ.allDay ? addDays(ns, dayDiff(occ.start, occ.end)) : new Date(ns.getTime() + dur);
			try {
				await this.plugin.store.moveOccurrence(occ, ns, ne);
			} catch (err) {
				new Notice(`Could not move event: ${err instanceof Error ? err.message : String(err)}`, 8000);
			}
		});
	}

	/**
	 * Time grid for `days` days starting at `first`. When only `visible` days fit, the
	 * grid scrolls horizontally with snapping to each day (mobile / narrow sidebar).
	 */
	private renderTimeGrid(first: Date, days: number, visible = days) {
		const s = this.plugin.settings;
		const last = addDays(first, days - 1);
		if (days === 1) {
			this.titleEl.setText(`${formatDate(first, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · W${this.weekNumber(first)}`);
		} else if (days < 7) {
			// Shortened week (narrow view): exact date range plus the week number(s).
			const weeks = Array.from(new Set(Array.from({ length: days }, (_, i) => this.weekNumber(addDays(first, i)))));
			const range = first.getMonth() === last.getMonth()
				? `${formatDate(first, { day: "numeric", month: "short" })} – ${formatDate(last, { day: "numeric" })}, ${last.getFullYear()}`
				: `${formatDate(first, { day: "numeric", month: "short" })} – ${formatDate(last, { day: "numeric", month: "short", year: "numeric" })}`;
			this.titleEl.setText(`${range} · W${weeks.length > 1 ? `${weeks[0]}–${weeks[weeks.length - 1]}` : weeks[0]}`);
		} else if (first.getMonth() === last.getMonth()) {
			this.titleEl.setText(`${formatDate(first, { month: "long", year: "numeric" })} · W${isoWeek(addDays(first, 3))}`);
		} else {
			this.titleEl.setText(
				`${formatDate(first, { month: "short" })} – ${formatDate(last, { month: "short", year: "numeric" })} · W${isoWeek(addDays(first, 3))}`
			);
		}
		const occs = this.plugin.store.getOccurrences(first, addDays(first, days), this.hidden);
		this.rendered = new Map(occs.map((o) => [o.key, o]));
		const allDay = occs.filter((o) => o.allDay || o.end.getTime() - o.start.getTime() >= 24 * 60 * MS_MIN);
		const timed = occs.filter((o) => !allDay.includes(o));
		const today = new Date();

		const wrap = this.bodyEl.createDiv({ cls: "ch-timegrid" });
		wrap.style.setProperty("--ch-days", String(days));
		const hscroll = visible < days;
		if (hscroll) {
			wrap.addClass("ch-tg-hscroll");
			wrap.style.setProperty("--ch-visible", String(visible));
			this.updateDayWidth(wrap, visible);
		}

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
				if (canDrag(occ)) {
					el.draggable = true;
					el.addEventListener("dragstart", (e) => {
						e.dataTransfer?.setData(DRAG_MIME, occ.key);
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

		if (hscroll) {
			// Header and all-day row follow the horizontal scroll of the hour grid.
			const sync = () => {
				// Shift header / all-day cells by the exact scroll offset (works during overscroll too).
				wrap.style.setProperty("--ch-sx", `${scroll.scrollLeft}px`);
			};
			let settle: number | null = null;
			scroll.addEventListener("scroll", () => {
				sync();
				// Remember the first visible day so re-renders keep the position.
				if (settle !== null) window.clearTimeout(settle);
				settle = window.setTimeout(() => {
					const dayW = this.dayWidth(wrap);
					if (dayW > 0) this.cursor = addDays(first, Math.round(scroll.scrollLeft / dayW));
				}, 150);
			});
			// Start with the cursor day (e.g. today) as the first visible day.
			window.requestAnimationFrame(() => {
				const idx = Math.max(0, Math.min(days - visible, dayDiff(first, this.cursor)));
				scroll.scrollLeft = idx * this.dayWidth(wrap);
				sync();
			});
		}
	}

	/** Width of one day column in the horizontally scrolling week view. */
	private dayWidth(wrap: HTMLElement): number {
		return parseFloat(wrap.style.getPropertyValue("--ch-day-w")) || 0;
	}

	private updateDayWidth(wrap: HTMLElement, visible: number) {
		const w = Math.max(0, (this.width || this.bodyEl.clientWidth) - HSCROLL_GUTTER);
		wrap.style.setProperty("--ch-day-w", `${Math.floor(w / visible)}px`);
	}

	/**
	 * Create events from empty time slots.
	 * Mouse / pen: press and drag to select a range, or click for a default-length event.
	 * Touch: swipe scrolls as usual; tap opens "new event" at that time; press and hold
	 * (~0.4 s), then drag to select a range. Only one selection can be active and only
	 * one event dialog is opened; cancelled gestures (e.g. the browser starting to scroll)
	 * are always cleaned up.
	 */
	private enableSlotSelection(col: HTMLElement, day: Date, minutesFromY: (y: number) => number) {
		let blockScroll = false;
		// Must be non-passive so scrolling can be stopped while a range is being selected.
		col.addEventListener("touchmove", (e) => {
			if (blockScroll && e.cancelable) e.preventDefault();
		}, { passive: false });
		col.addEventListener("contextmenu", (e) => {
			if (this.selection) e.preventDefault();
		});

		col.addEventListener("pointerdown", (down) => {
			if (down.button !== 0 || !down.isPrimary) return;
			if (this.selection || EventModal.openCount > 0) return;
			const touch = down.pointerType === "touch";
			const startX = down.clientX;
			const startY = down.clientY;
			const startMin = minutesFromY(down.clientY);
			let endMin = startMin + SNAP_MIN;
			let moved = false;
			let active = !touch; // touch becomes active after a long press
			let ghost: HTMLElement | null = null;
			let timer: number | null = null;

			const draw = () => {
				if (!ghost) ghost = col.createDiv({ cls: "ch-tg-selection" });
				const a = Math.min(startMin, endMin);
				const b = Math.max(startMin + SNAP_MIN, endMin);
				ghost.style.top = `${(a / 60) * HOUR_HEIGHT}px`;
				ghost.style.height = `${((b - a) / 60) * HOUR_HEIGHT}px`;
			};
			const cleanup = () => {
				window.removeEventListener("pointermove", move);
				window.removeEventListener("pointerup", up);
				window.removeEventListener("pointercancel", cancel);
				if (timer !== null) window.clearTimeout(timer);
				timer = null;
				ghost?.remove();
				ghost = null;
				blockScroll = false;
				col.removeClass("ch-selecting");
				if (this.selection === handle) this.selection = null;
			};
			const handle = { cancel: cleanup };

			const move = (e: PointerEvent) => {
				if (e.pointerId !== down.pointerId) return;
				if (!active) {
					// Finger moved before the long press: this is a scroll, not a selection.
					if (Math.hypot(e.clientX - startX, e.clientY - startY) > TOUCH_SLOP) cleanup();
					return;
				}
				const m = minutesFromY(e.clientY) + SNAP_MIN;
				if (m !== endMin) {
					endMin = m;
					moved = true;
					draw();
				}
			};
			const up = (e: PointerEvent) => {
				if (e.pointerId !== down.pointerId) return;
				cleanup();
				if (EventModal.openCount > 0) return;
				const a = moved ? Math.min(startMin, endMin - SNAP_MIN) : startMin;
				const start = addMinutes(startOfDay(day), a);
				const end = moved
					? addMinutes(startOfDay(day), Math.max(startMin + SNAP_MIN, endMin))
					: addMinutes(start, this.plugin.settings.defaultEventDuration);
				new EventModal(this.plugin, { start, end }).open();
			};
			const cancel = (e: PointerEvent) => {
				if (e.pointerId === down.pointerId) cleanup();
			};

			this.selection = handle;
			window.addEventListener("pointermove", move);
			window.addEventListener("pointerup", up);
			window.addEventListener("pointercancel", cancel);
			if (touch) {
				timer = window.setTimeout(() => {
					timer = null;
					active = true;
					blockScroll = true;
					col.addClass("ch-selecting");
					try {
						navigator.vibrate?.(15);
					} catch {
						/* not supported */
					}
					draw();
				}, LONG_PRESS_MS);
			} else {
				draw();
			}
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
