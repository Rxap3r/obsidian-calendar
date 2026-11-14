import { MarkdownRenderChild, Menu, Notice, Platform, Plugin, TFile, WorkspaceLeaf, WorkspaceSidedock, normalizePath } from "obsidian";
import { OmniCalendarSettings, CalendarOccurrence, LocalEvent, PluginData, SidebarView, ViewMode } from "./types";
import { OmniCalendarSettingTab, DEFAULT_SETTINGS } from "./settings";
import { CalendarStore } from "./store";
import { AccountManager } from "./sync/accounts";
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
	accounts!: AccountManager;
	private refreshTimer: number | null = null;
	private firstRun = false;
	private ribbonMenuShownAt = 0;
	private sidebarViewUnset = false;
	/** True while the plugin itself changes the sidebar (ignore those layout changes). */
	private applyingSidebar = false;

	/** Same object as `data.settings`. */
	settings!: OmniCalendarSettings;

	async onload() {
		await this.loadPluginData();
		this.accounts = new AccountManager(this);
		this.store = new CalendarStore(this);

		this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));
		this.registerView(VIEW_TYPE_MINI, (leaf) => new MiniCalendarView(leaf, this));
		this.addSettingTab(new OmniCalendarSettingTab(this.app, this));

		const ribbon = this.addRibbonIcon(
			"calendar-days",
			Platform.isMobile ? "Open calendar (hold for more)" : "Open calendar (right-click for more)",
			() => {
				// A long press that opened the menu must not also open the calendar.
				if (Date.now() - this.ribbonMenuShownAt < 1000) return;
				void this.openCalendar();
			}
		);
		ribbon.addClass("ch-ribbon-icon");
		// Desktop: right-click. (Some mobile browsers also send this on long press.)
		ribbon.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			this.showCalendarMenu({ x: e.clientX, y: e.clientY });
		});
		// Touch: press and hold.
		let holdTimer: number | null = null;
		let holdStart = { x: 0, y: 0 };
		const clearHold = () => {
			if (holdTimer !== null) window.clearTimeout(holdTimer);
			holdTimer = null;
		};
		ribbon.addEventListener("pointerdown", (e) => {
			if (e.pointerType === "mouse") return;
			holdStart = { x: e.clientX, y: e.clientY };
			clearHold();
			holdTimer = window.setTimeout(() => {
				holdTimer = null;
				try {
					navigator.vibrate?.(15);
				} catch {
					/* not supported */
				}
				this.showCalendarMenu(holdStart);
			}, 500);
		});
		ribbon.addEventListener("pointermove", (e) => {
			if (holdTimer !== null && Math.hypot(e.clientX - holdStart.x, e.clientY - holdStart.y) > 10) clearHold();
		});
		for (const ev of ["pointerup", "pointercancel", "pointerleave"]) ribbon.addEventListener(ev, clearHold);
		this.register(clearHold);

		this.addCommand({ id: "open-calendar", name: "Open calendar (full page)", callback: () => void this.openCalendar() });
		this.addCommand({
			id: "calendar-menu",
			name: "Calendar menu (open, sidebar, new event, settings)",
			callback: () => this.showCalendarMenu({ x: window.innerWidth / 2, y: window.innerHeight / 3 }),
		});
		this.addCommand({ id: "open-sidebar", name: "Show mini calendar in sidebar", callback: () => void this.openSidebar(true) });
		this.addCommand({ id: "toggle-sidebar-mini", name: "Toggle mini calendar in sidebar", callback: () => void this.toggleSidebar("mini") });
		this.addCommand({ id: "toggle-sidebar-full", name: "Toggle full calendar in sidebar", callback: () => void this.toggleSidebar("full") });
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
				this.settings.sidebarView = "mini";
			} else if (this.sidebarViewUnset) {
				// Upgrading from an older version: adopt whatever is in the sidebar now.
				this.settings.sidebarView = this.actualSidebarView();
			}
			await this.persist();
			await this.applySidebar(false);
			// From now on keep the setting in sync when the user closes or drags the sidebar calendar.
			this.registerEvent(this.app.workspace.on("layout-change", () => this.syncSidebarSetting()));
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
		settings.accounts = (raw.settings?.accounts ?? []).map((a) => ({ ...a }));
		// Drop calendars whose account no longer exists.
		settings.sources = settings.sources.filter((s) => !s.accountId || settings.accounts.some((a) => a.id === s.accountId));
		if (!settings.sources.some((s) => s.type === "local")) settings.sources.unshift({ ...DEFAULT_SETTINGS.sources[0] });
		if (!settings.sources.some((s) => s.id === settings.defaultCalendarId && s.type === "local")) {
			settings.defaultCalendarId = settings.sources.find((s) => s.type === "local")?.id ?? "personal";
		}
		const targets = Array.isArray(raw.settings?.defaultTargets) ? raw.settings.defaultTargets : [settings.defaultCalendarId];
		settings.defaultTargets = targets.filter((id) => settings.sources.some((s) => s.id === id));
		if (!settings.defaultTargets.length) settings.defaultTargets = [settings.defaultCalendarId];
		// sidebarOnStartup (≤ 1.5.1) → sidebarView
		this.sidebarViewUnset = !raw.settings?.sidebarView;
		if (this.sidebarViewUnset && raw.settings?.sidebarOnStartup && raw.settings.sidebarOnStartup !== "none") {
			settings.sidebarView = raw.settings.sidebarOnStartup;
			this.sidebarViewUnset = false;
		}
		delete settings.sidebarOnStartup;
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

	/** The calendar quick menu (ribbon right-click / long press, or the "Calendar menu" command). */
	showCalendarMenu(pos: { x: number; y: number }) {
		// Right-click and long press can both fire on some phones – show the menu only once.
		if (Date.now() - this.ribbonMenuShownAt < 800) return;
		this.ribbonMenuShownAt = Date.now();
		const menu = new Menu();
		menu.addItem((i) => i.setTitle("Open full calendar").setIcon("calendar-days").onClick(() => void this.openCalendar()));
		menu.addItem((i) =>
			i.setTitle(this.settings.sidebarView === "mini" ? "Hide mini calendar in sidebar" : "Show mini calendar in sidebar")
				.setIcon("panel-right").onClick(() => void this.toggleSidebar("mini"))
		);
		menu.addItem((i) =>
			i.setTitle(this.settings.sidebarView === "full" ? "Hide full calendar in sidebar" : "Show full calendar in sidebar")
				.setIcon("panel-right-open").onClick(() => void this.toggleSidebar("full"))
		);
		menu.addSeparator();
		menu.addItem((i) => i.setTitle("New event").setIcon("plus").onClick(() => new EventModal(this, { start: new Date(new Date().setHours(0, 0, 0, 0)) }).open()));
		menu.addSeparator();
		menu.addItem((i) => i.setTitle("Settings").setIcon("settings").onClick(() => this.openSettings()));
		menu.showAtPosition(pos);
	}

	/** True when the leaf lives in the left or right sidebar (not the main editor area). */
	isInSidebar(leaf: WorkspaceLeaf): boolean {
		const { workspace } = this.app;
		const root = leaf.getRoot();
		return root === workspace.leftSplit || root === workspace.rightSplit;
	}

	sidebarLeaves(type: string): WorkspaceLeaf[] {
		return this.app.workspace.getLeavesOfType(type).filter((l) => this.isInSidebar(l));
	}

	/** The sidebar chosen in settings. */
	private configuredSidebar() {
		const { workspace } = this.app;
		return this.settings.sidebarSide === "left" ? workspace.leftSplit : workspace.rightSplit;
	}

	/**
	 * Move calendar views that sit in the other sidebar into the configured one.
	 * Runs on startup and whenever the "Sidebar" setting changes.
	 */
	async enforceSidebarSide() {
		const target = this.configuredSidebar();
		for (const type of [VIEW_TYPE_MINI, VIEW_TYPE_CALENDAR]) {
			const leaves = this.sidebarLeaves(type);
			const alreadyThere = leaves.some((l) => l.getRoot() === target);
			for (const leaf of leaves) {
				if (leaf.getRoot() === target) continue;
				const state = leaf.getViewState();
				const sourceOpen = !(leaf.getRoot() as WorkspaceSidedock).collapsed;
				leaf.detach();
				if (alreadyThere) continue; // never create a duplicate
				const moved = this.newSidebarLeaf();
				if (!moved) continue;
				await moved.setViewState({ ...state, active: false });
				if (sourceOpen) await this.app.workspace.revealLeaf(moved);
			}
		}
	}

	/** Open the full calendar in the main area (never takes over a calendar that sits in a sidebar). */
	async openCalendar(date?: Date, mode?: ViewMode) {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).find((l) => !this.isInSidebar(l)) ?? null;
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			const state: Record<string, unknown> = {};
			if (mode) state.mode = mode;
			if (date) state.date = toDateKey(date);
			await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true, state });
		}
		await workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof CalendarView && (date || mode)) view.goTo(date ?? view.cursor, mode);
	}

	private newSidebarLeaf(): WorkspaceLeaf | null {
		const { workspace } = this.app;
		return this.settings.sidebarSide === "left" ? workspace.getLeftLeaf(false) : workspace.getRightLeaf(false);
	}

	/** Put the mini or full calendar into the sidebar (or reveal it if it is already there). */
	async showInSidebar(kind: "mini" | "full", reveal: boolean, state?: Record<string, unknown>) {
		const type = kind === "mini" ? VIEW_TYPE_MINI : VIEW_TYPE_CALENDAR;
		const target = this.configuredSidebar();
		let leaf = this.sidebarLeaves(type).find((l) => l.getRoot() === target);
		if (!leaf) {
			const created = this.newSidebarLeaf();
			if (!created) return;
			leaf = created;
			await leaf.setViewState({ type, active: reveal, state: state ?? (kind === "full" ? { mode: this.settings.defaultView } : {}) });
		}
		if (reveal) await this.app.workspace.revealLeaf(leaf);
	}

	/** What is actually in the sidebar right now. */
	actualSidebarView(): SidebarView {
		if (this.sidebarLeaves(VIEW_TYPE_MINI).length) return "mini";
		if (this.sidebarLeaves(VIEW_TYPE_CALENDAR).length) return "full";
		return "none";
	}

	/**
	 * Make the sidebar match the settings: right kind of calendar, on the right side, nothing else.
	 * Called on startup and whenever the sidebar settings change.
	 */
	async applySidebar(reveal: boolean) {
		this.applyingSidebar = true;
		try {
			await this.enforceSidebarSide();
			const want = this.settings.sidebarView;
			for (const type of [VIEW_TYPE_MINI, VIEW_TYPE_CALENDAR]) {
				const wanted = (want === "mini" && type === VIEW_TYPE_MINI) || (want === "full" && type === VIEW_TYPE_CALENDAR);
				if (!wanted) for (const leaf of this.sidebarLeaves(type)) leaf.detach();
			}
			if (want !== "none") await this.showInSidebar(want, reveal);
		} finally {
			// layout-change fires asynchronously; ignore it until things settled.
			window.setTimeout(() => (this.applyingSidebar = false), 300);
		}
	}

	/** The user closed or dragged the sidebar calendar: update the setting to match. */
	private syncSidebarSetting() {
		if (this.applyingSidebar) return;
		const actual = this.actualSidebarView();
		let changed = false;
		if (actual !== this.settings.sidebarView) {
			this.settings.sidebarView = actual;
			changed = true;
		}
		if (actual !== "none") {
			const leaf = this.sidebarLeaves(actual === "mini" ? VIEW_TYPE_MINI : VIEW_TYPE_CALENDAR)[0];
			const side = leaf && leaf.getRoot() === this.app.workspace.leftSplit ? "left" : "right";
			if (leaf && side !== this.settings.sidebarSide) {
				this.settings.sidebarSide = side;
				changed = true;
			}
		}
		if (changed) void this.persist();
	}

	/** "Move to sidebar" button of the full calendar: the sidebar now holds the full calendar. */
	async moveToSidebar(state: Record<string, unknown>) {
		this.settings.sidebarView = "full";
		await this.persist();
		this.applyingSidebar = true;
		for (const leaf of this.sidebarLeaves(VIEW_TYPE_MINI)) leaf.detach();
		for (const leaf of this.sidebarLeaves(VIEW_TYPE_CALENDAR)) leaf.detach();
		await this.showInSidebar("full", true, state);
		window.setTimeout(() => (this.applyingSidebar = false), 300);
	}

	/** Show the mini / full calendar in the sidebar, or hide it if it is already shown. */
	async toggleSidebar(kind: "mini" | "full") {
		this.settings.sidebarView = this.settings.sidebarView === kind ? "none" : kind;
		await this.persist();
		await this.applySidebar(true);
	}

	/** Show the mini calendar in the sidebar (command "Show mini calendar in sidebar"). */
	async openSidebar(reveal: boolean) {
		this.settings.sidebarView = "mini";
		await this.persist();
		await this.applySidebar(reveal);
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
