import { setIcon } from "obsidian";
import { CalendarOccurrence } from "../types";
import {
	addDays, addMonths, formatDate, formatTime, isoWeek, isSameDay, MS_MIN, onDay, startOfDay, startOfMonth,
	startOfWeek, weekdayNames,
} from "../dateUtils";
import { EventModal } from "../modals/EventModal";
import { rangeLabel } from "../periods";
import { plural } from "../util";
import { OmniView } from "./OmniView";
import { VIEW_TYPE_MINI } from "./viewTypes";
import { markDayCell, occurrenceMenu, openOccurrence, tooltip } from "./shared";

/** Compact month calendar + upcoming events, meant for the left/right sidebar. */
export class MiniCalendarView extends OmniView {
	private month: Date = startOfMonth(new Date());
	private selected: Date = startOfDay(new Date());
	private lastDay = startOfDay(new Date()).getTime();

	getViewType() {
		return VIEW_TYPE_MINI;
	}
	getDisplayText() {
		return "Mini calendar";
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
			}, 5 * MS_MIN)
		);
		this.render();
	}

	async onClose() {
		this.contentEl.empty();
	}

	render() {
		const s = this.plugin.settings;
		const el = this.contentEl;
		el.empty();

		// Header
		const head = el.createDiv({ cls: "ch-mini-head" });
		const title = head.createDiv({ cls: "ch-mini-title", text: formatDate(this.month, { month: "long", year: "numeric" }) });
		title.onclick = () => void this.plugin.openCalendar(this.month, "month");
		title.setAttr("aria-label", "Open in calendar");
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
		mk("maximize-2", "Open calendar", () => void this.plugin.openCalendar(this.selected));

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
			markDayCell(cell, day, this.month);
			if (isSameDay(day, this.selected)) cell.addClass("ch-selected");
			const dayOccs = onDay(occs, day);
			if (dayOccs.length) {
				const dots = cell.createDiv({ cls: "ch-mini-dots" });
				const colors = Array.from(new Set(dayOccs.map((o) => o.color))).slice(0, 3);
				for (const c of colors) dots.createSpan({ cls: "ch-mini-dot" }).style.backgroundColor = c;
				cell.setAttr("aria-label", plural(dayOccs.length, "event"));
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
		for (const o of selOccs) this.item(sel, o);

		// Upcoming
		const days = upcomingDays(s);
		if (days > 0) {
			const up = el.createDiv({ cls: "ch-mini-section" });
			const head = up.createDiv({ cls: "ch-mini-section-head", text: "Upcoming" });
			head.createSpan({ cls: "ch-mini-section-sub", text: ` · ${rangeLabel(days)}` });
			const from = addDays(startOfDay(this.selected), 1);
			const upOccs = this.plugin.store.getOccurrences(from, addDays(from, days)).filter((o) => o.start >= from)
				.sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.allDay) - Number(a.allDay));
			if (!upOccs.length) up.createDiv({ cls: "ch-empty", text: `Nothing planned ${rangeLabel(days)}` });
			let lastKey = "";
			for (const o of upOccs.slice(0, MAX_UPCOMING)) {
				const key = startOfDay(o.start).toDateString();
				if (key !== lastKey) {
					up.createDiv({ cls: "ch-mini-upcoming-date", text: formatDate(o.start, { weekday: "short", day: "numeric", month: "short" }) });
					lastKey = key;
				}
				this.item(up, o);
			}
			if (upOccs.length > MAX_UPCOMING) {
				const more = up.createEl("button", { cls: "ch-mini-more", text: `${upOccs.length - MAX_UPCOMING} more – open agenda` });
				more.addEventListener("click", () => void this.plugin.openCalendar(from, "agenda"));
			}
		}
	}

	private item(parent: HTMLElement, o: CalendarOccurrence) {
		const s = this.plugin.settings;
		const row = parent.createDiv({ cls: "ch-mini-item" });
		row.style.setProperty("--ch-event-color", o.color);
		if (o.end < new Date()) row.addClass("ch-past");
		row.createSpan({ cls: "ch-mini-item-bar" });
		row.createSpan({ cls: "ch-mini-item-time", text: o.allDay ? "All day" : formatTime(o.start, s.use24h) });
		row.createSpan({ cls: "ch-mini-item-title", text: o.title });
		row.setAttr("title", tooltip(this.plugin, o));
		row.onclick = () => openOccurrence(this.plugin, o);
		row.oncontextmenu = (e) => {
			e.preventDefault();
			occurrenceMenu(this.plugin, o, e);
		};
	}
}

/** Events listed at most under "Upcoming" (the rest is reachable via the agenda). */
const MAX_UPCOMING = 100;

/** Days shown under "Upcoming"; -1 means "same as the agenda length". */
export function upcomingDays(s: { sidebarUpcomingDays: number; agendaDays: number }): number {
	return s.sidebarUpcomingDays < 0 ? s.agendaDays : s.sidebarUpcomingDays;
}
