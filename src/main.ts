import { MarkdownRenderChild, Notice, Plugin, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import { OmniCalendarSettings, CalendarOccurrence, LocalEvent, PluginData, ViewMode } from "./types";
import { OmniCalendarSettingTab, DEFAULT_SETTINGS } from "./settings";
import { CalendarStore } from "./store";
import { CalendarView, VIEW_TYPE_CALENDAR } from "./views/CalendarView";
import { MiniCalendarView, VIEW_TYPE_MINI } from "./views/MiniCalendarView";
import { EventModal } from "./modals/EventModal";
import { createEventNote } from "./notes";
import { buildIcs } from "./ics";
import { addDays, formatDate, formatTime, isSameDay, overlapsDay, parseLocal, startOfDay, toDateKey } from "./dateUtils";
import { openOccurrence } from "./views/shared";

export default class OmniCalendarPlugin extends Plugin {
	data!: PluginData;
	store!: CalendarStore;
	private refreshTimer: number | null = null;
	private firstRun = false;

	/** Same object as `data.settings`. */
	settings!: OmniCalendarSettings;

	async onload() {
		await this.loadPluginData();
		this.store = new CalendarStore(this);

		this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));
		this.registerView(VIEW_TYPE_MINI, (leaf) => new MiniCalendarView(leaf, this));
		this.addSettingTab(new OmniCalendarSettingTab(this.app, this));

		this.addRibbonIcon("calendar-days", "Open calendar", () => void this.openCalendar());

		this.addCommand({ id: "open-calendar", name: "Open calendar (full page)", callback: () => void this.openCalendar() });
		this.addCommand({ id: "open-sidebar", name: "Show calendar in sidebar", callback: () => void this.openSidebar(true) });
		this.addCommand({ id: "new-event", name: "Create new event", callback: () => new EventModal(this, { start: new Date(new Date().setHours(0, 0, 0, 0)) }).open() });
		this.addCommand({ id: "refresh", name: "Refresh external calendars", callback: async () => {
			await this.store.refreshAll();
			new Notice("Calendars refreshed");
		} });
		for (const mode of ["month", "week", "day", "agenda"] as ViewMode[]) {
			this.addCommand({ id: `open-${mode}`, name: `Open ${mode} view`, callback: () => void this.openCalendar(new Date(), mode) });
		}
		this.addCommand({ id: "export-ics", name: "Export local events to .ics file", callback: () => void this.exportIcs() });
		this.addCommand({
			id: "new-event-from-note",
			name: "Create event linked to current note",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!checking) this.newEventFromNote(file);
				return true;
			},
		});

		this.registerMarkdownCodeBlockProcessor("omni-calendar", (source, el, ctx) => {
			const child = new AgendaBlock(this, el, source);
			ctx.addChild(child);
		});

		// Keep linked note paths in sync when notes are renamed / deleted.
		this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
			let changed = false;
			for (const ev of this.data.events) if (ev.notePath === oldPath) { ev.notePath = file.path; changed = true; }
			if (changed) await this.persist();
		}));
		this.registerEvent(this.app.vault.on("delete", async (file) => {
			let changed = false;
			for (const ev of this.data.events) if (ev.notePath === file.path) { ev.notePath = undefined; changed = true; }
			if (changed) await this.persist();
		}));

		this.app.workspace.onLayoutReady(async () => {
			await this.store.loadCached();
			if (this.firstRun) {
				await this.openSidebar(false);
				await this.persist();
			}
			void this.store.refreshAll();
			this.scheduleRefresh();
		});
	}

	onunload() {
		if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
	}

	// ------------------------------------------------------------------ data

	private async loadPluginData() {
		const loaded = (await this.loadData()) as Partial<PluginData> | null;
		this.firstRun = !loaded;
		const raw = loaded ?? {};
		const settings: OmniCalendarSettings = Object.assign({}, DEFAULT_SETTINGS, raw.settings ?? {});
		settings.sources = (raw.settings?.sources ?? DEFAULT_SETTINGS.sources).map((s) => ({ ...s }));
		if (!settings.sources.some((s) => s.type === "local")) settings.sources.unshift({ ...DEFAULT_SETTINGS.sources[0] });
		if (!settings.sources.some((s) => s.id === settings.defaultCalendarId && s.type === "local")) {
			settings.defaultCalendarId = settings.sources.find((s) => s.type === "local")?.id ?? "personal";
		}
		this.data = { settings, events: Array.isArray(raw.events) ? raw.events : [] };
		this.settings = settings;
	}

	/** Called by Obsidian when data.json was changed externally (e.g. by Sync). */
	async onExternalSettingsChange() {
		await this.loadPluginData();
		this.store.notify();
	}

	async persist() {
		await this.saveData(this.data);
	}

	scheduleRefresh() {
		if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
		this.refreshTimer = null;
		const mins = this.settings.refreshIntervalMinutes;
		if (mins > 0) {
			this.refreshTimer = window.setInterval(() => void this.store.refreshAll(), mins * 60 * 1000);
			this.registerInterval(this.refreshTimer);
		}
	}

	// ------------------------------------------------------------------ views

	async openCalendar(date?: Date, mode?: ViewMode) {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
		}
		await workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof CalendarView && (date || mode)) view.goTo(date ?? view.cursor, mode);
	}

	async openSidebar(reveal: boolean) {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_MINI)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			leaf = right;
			await leaf.setViewState({ type: VIEW_TYPE_MINI, active: true });
		}
		if (reveal) await workspace.revealLeaf(leaf);
	}

	openSettings() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const setting = (this.app as any).setting;
		setting?.open?.();
		setting?.openTabById?.(this.manifest.id);
	}

	// ------------------------------------------------------------------ notes

	async openNoteForOccurrence(occ: CalendarOccurrence) {
		const file = await createEventNote(this.app, occ, {
			folder: this.settings.notesFolder,
			template: this.settings.noteTemplate,
			calendarName: this.store.getSource(occ.sourceId)?.name ?? "",
			use24h: this.settings.use24h,
		});
		if (file) await this.app.workspace.getLeaf("tab").openFile(file);
		return file;
	}

	async openNoteForLocalEvent(ev: LocalEvent, occurrenceDate?: string) {
		if (ev.notePath) {
			const f = this.app.vault.getAbstractFileByPath(ev.notePath);
			if (f instanceof TFile) {
				await this.app.workspace.getLeaf("tab").openFile(f);
				return;
			}
		}
		const day = occurrenceDate ? parseLocal(occurrenceDate) : parseLocal(ev.start);
		const occ = this.store.getOccurrencesForDay(day).find((o) => o.eventId === ev.id);
		if (!occ) return;
		const file = await this.openNoteForOccurrence(occ);
		if (file && !ev.recurrence) await this.store.updateEvent(ev.id, { notePath: file.path });
	}

	private newEventFromNote(file: TFile) {
		const m = /(\d{4}-\d{2}-\d{2})/.exec(file.basename);
		const day = m ? parseLocal(m[1]) : startOfDay(new Date());
		const title = file.basename.replace(/^\d{4}-\d{2}-\d{2}\s*/, "") || file.basename;
		new EventModal(this, { start: day, title, notePath: file.path }).open();
	}

	// ------------------------------------------------------------------ export

	private async exportIcs() {
		const events = this.data.events.map((ev) => {
			const { start, end } = CalendarStore.bounds(ev);
			let rrule: string | undefined;
			if (ev.recurrence) {
				const r = ev.recurrence;
				rrule = `FREQ=${r.freq.toUpperCase()};INTERVAL=${r.interval || 1}`;
				if (r.count) rrule += `;COUNT=${r.count}`;
				if (r.until) rrule += `;UNTIL=${r.until.replace(/-/g, "")}${ev.allDay ? "" : "T235959Z"}`;
			}
			const exdates = (ev.exdates ?? []).map((d) => {
				const x = parseLocal(d);
				return ev.allDay ? x : new Date(x.getFullYear(), x.getMonth(), x.getDate(), start.getHours(), start.getMinutes());
			});
			return { uid: ev.id, title: ev.title, start, end, allDay: ev.allDay, location: ev.location, description: ev.description, rrule, exdates };
		});
		const ics = buildIcs(events, "Obsidian Omni Calendar");
		const folder = this.settings.notesFolder || "";
		const path = normalizePath(`${folder ? folder + "/" : ""}omni-calendar-export-${toDateKey(new Date())}.ics`);
		try {
			if (folder && !this.app.vault.getAbstractFileByPath(normalizePath(folder))) await this.app.vault.createFolder(normalizePath(folder));
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) await this.app.vault.modify(existing, ics);
			else await this.app.vault.create(path, ics);
			new Notice(`Exported ${events.length} events to ${path}`);
		} catch (e) {
			new Notice(`Export failed: ${e instanceof Error ? e.message : e}`);
		}
	}
}

/**
 * ```omni-calendar
 * days: 7
 * calendars: Personal, Work
 * ```
 * Renders an agenda of upcoming events inside a note.
 */
class AgendaBlock extends MarkdownRenderChild {
	constructor(private plugin: OmniCalendarPlugin, containerEl: HTMLElement, private source: string) {
		super(containerEl);
	}

	onload() {
		this.render();
		this.registerEvent(this.plugin.store.on("changed", () => this.render()));
	}

	private render() {
		const opts: Record<string, string> = {};
		for (const line of this.source.split("\n")) {
			const m = /^\s*(\w+)\s*:\s*(.+)$/.exec(line);
			if (m) opts[m[1].toLowerCase()] = m[2].trim();
		}
		const days = Math.max(1, Math.min(365, parseInt(opts.days ?? "7") || 7));
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
			el.createDiv({ cls: "ch-empty", text: `No events in the next ${days} day${days > 1 ? "s" : ""}.` });
			return;
		}
		const use24h = this.plugin.settings.use24h;
		for (let i = 0; i < days; i++) {
			const day = addDays(from, i);
			const list = occs.filter((o) => overlapsDay(o.start, o.end, day));
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
