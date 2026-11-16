import { MarkdownRenderChild } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { addDays, formatDate, formatTime, isSameDay, onDay, parseLocal, startOfDay } from "../dateUtils";
import { clamp, plural } from "../util";
import { openOccurrence } from "./shared";

/**
 * ```omni-calendar
 * days: 7
 * calendars: Personal, Work
 * ```
 * Renders an agenda of upcoming events inside a note.
 */
export class AgendaBlock extends MarkdownRenderChild {
	constructor(private plugin: OmniCalendarPlugin, containerEl: HTMLElement, private source: string) {
		super(containerEl);
	}

	onload() {
		this.render();
		this.registerEvent(this.plugin.store.on("changed", () => this.render()));
	}

	/** The `key: value` lines of the code block. */
	private options(): Record<string, string> {
		const opts: Record<string, string> = {};
		for (const line of this.source.split("\n")) {
			const m = /^\s*(\w+)\s*:\s*(.+)$/.exec(line);
			if (m) opts[m[1].toLowerCase()] = m[2].trim();
		}
		return opts;
	}

	private render() {
		const opts = this.options();
		const days = clamp(parseInt(opts.days ?? "7") || 7, 1, 365);
		const start = opts.date ? parseLocal(opts.date) : startOfDay(new Date());
		const from = isNaN(start.getTime()) ? startOfDay(new Date()) : start;
		const names = opts.calendars ? opts.calendars.split(",").map((x) => x.trim().toLowerCase()) : null;
		const hidden = new Set<string>();
		if (names) for (const s of this.plugin.settings.sources) if (!names.includes(s.name.toLowerCase())) hidden.add(s.id);

		const el = this.containerEl;
		el.empty();
		el.addClass("ch-embed");
		const occs = this.plugin.store.getOccurrences(from, addDays(from, days), hidden);
		if (!occs.length) {
			el.createDiv({ cls: "ch-empty", text: `No events in the next ${plural(days, "day")}.` });
			return;
		}
		const use24h = this.plugin.settings.use24h;
		for (let i = 0; i < days; i++) {
			const day = addDays(from, i);
			const list = onDay(occs, day);
			if (!list.length) continue;
			const h = el.createDiv({ cls: "ch-embed-date", text: formatDate(day, { weekday: "long", day: "numeric", month: "long" }) });
			if (isSameDay(day, new Date())) h.addClass("ch-today");
			for (const o of list) {
				const row = el.createDiv({ cls: "ch-mini-item" });
				row.style.setProperty("--ch-event-color", o.color);
				row.createSpan({ cls: "ch-mini-item-bar" });
				row.createSpan({ cls: "ch-mini-item-time", text: o.allDay ? "All day" : `${formatTime(o.start, use24h)}–${formatTime(o.end, use24h)}` });
				row.createSpan({ cls: "ch-mini-item-title", text: o.title });
				if (o.location) row.createSpan({ cls: "ch-mini-item-loc", text: o.location });
				row.onclick = () => openOccurrence(this.plugin, o);
			}
		}
	}
}
