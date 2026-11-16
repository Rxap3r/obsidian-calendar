import { Menu, setIcon, ViewStateResult, WorkspaceLeaf } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { CalendarOccurrence, ViewMode } from "../types";
import { addDays, addMonths, MS_MIN, parseLocal, startOfDay, startOfMonth, startOfWeek, toDateKey } from "../dateUtils";
import { EventModal } from "../modals/EventModal";
import { OmniView } from "./OmniView";
import { VIEW_TYPE_CALENDAR } from "./viewTypes";
import { CalendarHost } from "./calendar/host";
import { monthLayout, weekDayCount } from "./calendar/layout";
import { EventDrag } from "./calendar/eventDrag";
import { SlotSelection } from "./calendar/slotSelection";
import { renderMonth, renderMonthCompact } from "./calendar/month";
import { renderTimeGrid, updateDayWidth, updateNowLine } from "./calendar/timeGrid";
import { renderAgenda } from "./calendar/agenda";

interface ViewState {
	mode?: ViewMode;
	date?: string;
}

/**
 * The calendar: a page in the main area, or the "day planner" when it sits in a sidebar.
 * This file holds the frame (toolbar, navigation, resizing); the month, week / day and agenda
 * layouts are drawn by the files in `calendar/`.
 */
export class CalendarView extends OmniView implements CalendarHost {
	mode: ViewMode;
	cursor: Date = startOfDay(new Date());
	/** Calendars hidden with the filter button (source ids). */
	hidden = new Set<string>();
	bodyEl!: HTMLElement;
	/** The date range in the toolbar ("November 2026"). */
	private rangeEl!: HTMLElement;
	private modeButtons: Partial<Record<ViewMode, HTMLElement>> = {};
	scrollTop: number | null = null;
	private locationBtn: HTMLElement | null = null;
	width = 0;
	/** Decides when a new width needs a different layout (compact month, fewer week days). */
	private layoutKey = "";
	monthSelected: Date | null = null;
	readonly drag: EventDrag;
	readonly slots: SlotSelection;

	constructor(leaf: WorkspaceLeaf, plugin: OmniCalendarPlugin) {
		super(leaf, plugin);
		this.mode = plugin.settings.defaultView;
		this.drag = new EventDrag(plugin);
		this.slots = new SlotSelection(plugin);
	}

	setTitle(text: string) {
		this.rangeEl.setText(text);
	}

	occurrences(start: Date, end: Date): CalendarOccurrence[] {
		const occs = this.plugin.store.getOccurrences(start, end, this.hidden);
		this.drag.remember(occs);
		return occs;
	}

	getViewType() {
		return VIEW_TYPE_CALENDAR;
	}
	/** "Day planner" in a sidebar, "Calendar" in the main area – the same names as in menus and settings. */
	getDisplayText() {
		return this.inSidebar() ? "Day planner" : "Calendar";
	}
	getIcon() {
		return this.inSidebar() ? "calendar-clock" : "calendar-days";
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
		this.registerInterval(window.setInterval(() => updateNowLine(this.bodyEl), MS_MIN));
		this.render();
	}

	async onClose() {
		this.contentEl.empty();
	}

	/** Navigate to a date and (optionally) a view mode. */
	goTo(date: Date, mode?: ViewMode) {
		this.cursor = startOfDay(date);
		this.monthSelected = startOfDay(date);
		if (mode) {
			this.mode = mode;
			this.rememberSidebarMode();
		}
		this.scrollTop = null;
		this.render();
		this.app.workspace.requestSaveLayout();
	}

	/** In the sidebar, the chosen view is remembered for the next time the day planner opens. */
	private rememberSidebarMode() {
		const s = this.plugin.settings;
		if (s.sidebarCalendarMode === this.mode || !this.plugin.sidebar.contains(this.leaf)) return;
		s.sidebarCalendarMode = this.mode;
		void this.plugin.persist();
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
		this.rangeEl = bar.createDiv({ cls: "ch-title" });

		const right = bar.createDiv({ cls: "ch-toolbar-group ch-toolbar-right" });
		const modes = right.createDiv({ cls: "ch-segmented" });
		const labels: Record<ViewMode, string> = { month: "Month", week: "Week", day: "Day", agenda: "Agenda" };
		(Object.keys(labels) as ViewMode[]).forEach((m) => {
			const b = modes.createEl("button", { text: labels[m] });
			b.onclick = () => {
				this.mode = m;
				this.rememberSidebarMode();
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
			await this.plugin.refreshCalendars();
			refresh.removeClass("ch-spin");
		};

		const add = right.createEl("button", { cls: "mod-cta ch-new-btn", attr: { "aria-label": "New event" } });
		setIcon(add.createSpan(), "plus");
		add.createSpan({ text: "New", cls: "ch-new-label" });
		add.onclick = () => new EventModal(this.plugin, { start: this.cursor }).open();
	}

	private updateLocationButton() {
		const btn = this.locationBtn;
		if (!btn) return;
		const inSidebar = this.plugin.sidebar.contains(this.leaf);
		btn.empty();
		setIcon(btn, inSidebar ? "maximize-2" : "panel-right-open");
		const after = { mini: " (the sidebar switches to the mini calendar)", close: " (closes the day planner)", keep: " (keeps the day planner)" }[this.plugin.settings.sidebarOnExpand];
		btn.setAttr("aria-label", inSidebar ? `Open calendar${after}` : "Move to sidebar as day planner");
		this.contentEl.toggleClass("ch-in-sidebar", inSidebar);
		// Tab title and icon depend on where the view is ("Calendar" vs "Day planner").
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(this.leaf as any).updateHeader?.();
	}

	/** Sidebar → open the full page in the main area. Main area → move this calendar into the sidebar. */
	private async toggleLocation() {
		if (this.plugin.sidebar.contains(this.leaf)) {
			await this.plugin.sidebar.expand(this.leaf, this.cursor, this.mode);
			return;
		}
		await this.plugin.sidebar.moveCalendarIn({ mode: this.mode, date: toDateKey(this.cursor) });
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
		this.slots.cancel();
		if (!this.width) this.width = Math.round(this.bodyEl.clientWidth);
		this.layoutKey = this.computeLayoutKey();
		switch (this.mode) {
			case "month": {
				const layout = this.monthLayout();
				if (layout === "full") renderMonth(this);
				else renderMonthCompact(this, layout === "dots");
				break;
			}
			case "week":
				// Always the whole week; if not all days fit, it scrolls sideways day by day.
				renderTimeGrid(this, startOfWeek(this.cursor, this.plugin.settings.firstDayOfWeek), 7, weekDayCount(this.width));
				break;
			case "day": renderTimeGrid(this, this.cursor, 1); break;
			case "agenda": renderAgenda(this); break;
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
			if (wrap) updateDayWidth(this, wrap, weekDayCount(this.width));
		}
	}

	private computeLayoutKey(): string {
		return `${this.monthLayout()}|${weekDayCount(this.width)}`;
	}

	private monthLayout() {
		return monthLayout(this.width, this.plugin.settings.showWeekNumbers);
	}
}
