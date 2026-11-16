import type OmniCalendarPlugin from "../../main";
import { CalendarOccurrence } from "../../types";
import { addDays, formatDate, formatTime, isSameDay, onDay, startOfDay } from "../../dateUtils";
import { occurrenceMenu, openOccurrence, taskHint } from "../shared";
import { CalendarHost } from "./host";

/** The agenda: the events of the next days as a list, grouped by day. */
export function renderAgenda(host: CalendarHost) {
	const s = host.plugin.settings;
	const start = startOfDay(host.cursor);
	const end = addDays(start, s.agendaDays);
	host.setTitle(
		`${formatDate(start, { day: "numeric", month: "short" })} – ${formatDate(addDays(end, -1), { day: "numeric", month: "short", year: "numeric" })}`
	);
	const occs = host.occurrences(start, end);
	const wrap = host.bodyEl.createDiv({ cls: "ch-agenda" });
	if (!occs.length) {
		wrap.createDiv({ cls: "ch-empty", text: "No events in this period." });
		return;
	}
	const today = new Date();
	for (let i = 0; i < s.agendaDays; i++) {
		const day = addDays(start, i);
		const dayOccs = onDay(occs, day);
		if (!dayOccs.length) continue;
		const group = wrap.createDiv({ cls: "ch-agenda-day" });
		if (isSameDay(day, today)) group.addClass("ch-today");
		const h = group.createDiv({ cls: "ch-agenda-date" });
		h.createSpan({ cls: "ch-agenda-daynum", text: String(day.getDate()) });
		h.createSpan({ cls: "ch-agenda-dayname", text: `${formatDate(day, { weekday: "long" })} · ${formatDate(day, { month: "long", year: "numeric" })}` });
		h.onclick = () => host.goTo(day, "day");
		for (const o of dayOccs) agendaItem(host.plugin, group, o, day);
	}
}

function agendaItem(plugin: OmniCalendarPlugin, parent: HTMLElement, o: CalendarOccurrence, day: Date) {
	const s = plugin.settings;
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
	taskHint(plugin, main.createDiv({ cls: "ch-agenda-title", text: o.title }), o);
	const sub = [o.location, plugin.store.getSource(o.sourceId)?.name].filter(Boolean).join(" · ");
	if (sub) main.createDiv({ cls: "ch-agenda-sub", text: sub });
	row.onclick = () => openOccurrence(plugin, o);
	row.oncontextmenu = (e) => {
		e.preventDefault();
		occurrenceMenu(plugin, o, e);
	};
}
