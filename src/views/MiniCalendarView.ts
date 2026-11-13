import { ItemView, setIcon, WorkspaceLeaf } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { CalendarOccurrence } from "../types";
import {
	addDays, addMonths, formatDate, formatTime, isoWeek, isSameDay, overlapsDay, startOfDay, startOfMonth,
	startOfWeek, weekdayNames,
} from "../dateUtils";
import { EventModal } from "../modals/EventModal";
import { occurrenceMenu, openOccurrence, tooltip } from "./shared";

export const VIEW_TYPE_MINI = "omni-calendar-mini";

/** Compact month calendar + upcoming events, meant for the left/right sidebar. */
export class MiniCalendarView extends ItemView {
	private month: Date = startOfMonth(new Date());
	private selected: Date = startOfDay(new Date());
	private renderQueued = false;
	private lastDay = startOfDay(new Date()).getTime();

	constructor(leaf: WorkspaceLeaf, private plugin: OmniCalendarPlugin) {
		super(leaf);
	}

	getViewType() {
		return VIEW_TYPE_MINI;
	}
	getDisplayText() {
		return "Calendar (mini)";
	}
	getIcon() {
		return "calendar";
	}

	async onOpen() {
		this.contentEl.addClass("ch-mini");
		this.registerEvent(this.plugin.store.on("changed", () => this.queueRender()));
		// Re-render after midnight and periodically so "today" and past events stay accurate.
		this.registerInterval(
			window.setInterval(() => {
				const d = startOfDay(new Date()).getTime();
				if (d !== this.lastDay) {
					if (this.selected.getTime() === this.lastDay) this.selected = new Date(d);
					this.lastDay = d;
				}
				this.render();
			}, 5 * 60 * 1000)
		);
		this.render();
	}

	async onClose() {
		this.contentEl.empty();
	}

	private queueRender() {
		if (this.renderQueued) return;
		this.renderQueued = true;
		window.requestAnimationFrame(() => {
			this.renderQueued = false;
			this.render();
		});
	}

	render() {
		const s = this.plugin.settings;
		const el = this.contentEl;
		el.empty();

		// Header
		const head = el.createDiv({ cls: "ch-mini-head" });
		const title = head.createDiv({ cls: "ch-mini-title", text: formatDate(this.month, { month: "long", year: "numeric" }) });
		title.onclick = () => void this.plugin.openCalendar(this.month, "month");
		title.setAttr("aria-label", "Open in full calendar");
		const btns = head.createDiv({ cls: "ch-mini-nav" });
		const mk = (icon: string, label: string, fn: () => void) => {
			const b = btns.createEl("button", { cls: "ch-icon-btn clickable-icon", attr: { "aria-label": label } });
			setIcon(b, icon);
			b.onclick = fn;
		};
		mk("chevron-left", "Previous month", () => {
			this.month = addMonths(this.month, -1);
			this.render();
		});
		mk("circle-dot", "Today", () => {
			this.month = startOfMonth(new Date());
			this.selected = startOfDay(new Date());
			this.render();
		});
		mk("chevron-right", "Next month", () => {
			this.month = addMonths(this.month, 1);
			this.render();
		});
		mk("plus", "New event", () => new EventModal(this.plugin, { start: this.selected }).open());
		mk("maximize-2", "Open full calendar", () => void this.plugin.openCalendar(this.selected));

		// Grid
		const gridStart = startOfWeek(this.month, s.firstDayOfWeek);
		const occs = this.plugin.store.getOccurrences(gridStart, addDays(gridStart, 42));
		const grid = el.createDiv({ cls: "ch-mini-grid" });
		if (s.showWeekNumbers) grid.addClass("ch-with-weeknums");
		if (s.showWeekNumbers) grid.createDiv({ cls: "ch-mini-wd ch-mini-wn", text: "" });
		for (const n of weekdayNames(s.firstDayOfWeek, "narrow")) grid.createDiv({ cls: "ch-mini-wd", text: n });
		const today = new Date();
		for (let i = 0; i < 42; i++) {
			const day = addDays(gridStart, i);
			if (s.showWeekNumbers && i % 7 === 0) grid.createDiv({ cls: "ch-mini-wn", text: String(isoWeek(addDays(day, 3))) });
			const cell = grid.createDiv({ cls: "ch-mini-day" });
			cell.createSpan({ text: String(day.getDate()) });
			if (day.getMonth() !== this.month.getMonth()) cell.addClass("ch-other-month");
			if (isSameDay(day, today)) cell.addClass("ch-today");
			if (isSameDay(day, this.selected)) cell.addClass("ch-selected");
			const dayOccs = occs.filter((o) => overlapsDay(o.start, o.end, day));
			if (dayOccs.length) {
				const dots = cell.createDiv({ cls: "ch-mini-dots" });
				const colors = Array.from(new Set(dayOccs.map((o) => o.color))).slice(0, 3);
				for (const c of colors) dots.createSpan({ cls: "ch-mini-dot" }).style.backgroundColor = c;
				cell.setAttr("aria-label", `${dayOccs.length} event${dayOccs.length > 1 ? "s" : ""}`);
			}
			cell.onclick = () => {
				this.selected = day;
				if (day.getMonth() !== this.month.getMonth()) this.month = startOfMonth(day);
				this.render();
			};
			cell.ondblclick = () => void this.plugin.openCalendar(day, "day");
		}

		// Selected day
		const sel = el.createDiv({ cls: "ch-mini-section" });
		const selHead = sel.createDiv({ cls: "ch-mini-section-head" });
		selHead.createSpan({ text: isSameDay(this.selected, today) ? "Today" : formatDate(this.selected, { weekday: "long", day: "numeric", month: "short" }) });
		const addBtn = selHead.createEl("button", { cls: "ch-icon-btn clickable-icon", attr: { "aria-label": "Add event on this day" } });
		setIcon(addBtn, "plus");
		addBtn.onclick = () => new EventModal(this.plugin, { start: this.selected }).open();
		const selOccs = this.plugin.store.getOccurrencesForDay(this.selected);
		if (!selOccs.length) sel.createDiv({ cls: "ch-empty", text: "No events" });
		for (const o of selOccs) this.item(sel, o, false);

		// Upcoming
		if (s.sidebarUpcomingDays > 0) {
			const up = el.createDiv({ cls: "ch-mini-section" });
			up.createDiv({ cls: "ch-mini-section-head", text: "Upcoming" });
			const from = addDays(startOfDay(this.selected), 1);
			const upOccs = this.plugin.store.getOccurrences(from, addDays(from, s.sidebarUpcomingDays)).filter((o) => o.start >= from)
				.sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.allDay) - Number(a.allDay));
			if (!upOccs.length) up.createDiv({ cls: "ch-empty", text: `Nothing in the next ${s.sidebarUpcomingDays} days` });
			let lastKey = "";
			for (const o of upOccs.slice(0, 30)) {
				const key = startOfDay(o.start).toDateString();
				if (key !== lastKey) {
					up.createDiv({ cls: "ch-mini-upcoming-date", text: formatDate(o.start, { weekday: "short", day: "numeric", month: "short" }) });
					lastKey = key;
				}
				this.item(up, o, false);
			}
		}
	}

	private item(parent: HTMLElement, o: CalendarOccurrence, showDate: boolean) {
		const s = this.plugin.settings;
		const row = parent.createDiv({ cls: "ch-mini-item" });
		row.style.setProperty("--ch-event-color", o.color);
		if (o.end < new Date()) row.addClass("ch-past");
		row.createSpan({ cls: "ch-mini-item-bar" });
		const time = o.allDay ? "All day" : formatTime(o.start, s.use24h);
		row.createSpan({ cls: "ch-mini-item-time", text: showDate ? `${formatDate(o.start, { day: "numeric", month: "short" })} ${time}` : time });
		row.createSpan({ cls: "ch-mini-item-title", text: o.title });
		row.setAttr("title", tooltip(this.plugin, o));
		row.onclick = () => openOccurrence(this.plugin, o);
		row.oncontextmenu = (e) => {
			e.preventDefault();
			occurrenceMenu(this.plugin, o, e);
		};
	}
}
