import { Menu, Notice, Platform, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { OmniCalendarSettings, CalendarOccurrence, PluginData, ViewMode } from "./types";
import { OmniCalendarSettingTab } from "./settings/SettingTab";
import { normalizePluginData } from "./settingsData";
import { CalendarStore } from "./store";
import { TaskStore } from "./tasks";
import { AccountManager } from "./sync/accounts";
import { SidebarManager } from "./sidebar";
import { registerCommands } from "./commands";
import { CalendarView } from "./views/CalendarView";
import { MiniCalendarView } from "./views/MiniCalendarView";
import { TasksView } from "./views/TasksView";
import { AgendaBlock } from "./views/AgendaBlock";
import { VIEW_TYPE_CALENDAR, VIEW_TYPE_MINI, VIEW_TYPE_TASKS } from "./views/viewTypes";
import { TaskModal } from "./modals/TaskModal";
import { EventModal } from "./modals/EventModal";
import { createEventNote, eventNotePath } from "./notes";
import { MS_DAY, MS_HOUR, MS_MIN, startOfDay, toDateKey } from "./dateUtils";

export default class OmniCalendarPlugin extends Plugin {
	data!: PluginData;
	/** Same object as `data.settings`. */
	settings!: OmniCalendarSettings;
	store!: CalendarStore;
	tasks!: TaskStore;
	accounts!: AccountManager;
	sidebar!: SidebarManager;
	private refreshTimer: number | null = null;
	private firstRun = false;
	private sidebarViewUnset = false;
	private ribbonMenuShownAt = 0;

	async onload() {
		await this.loadPluginData();
		this.accounts = new AccountManager(this);
		this.store = new CalendarStore(this);
		this.tasks = new TaskStore(this);
		this.sidebar = new SidebarManager(this);

		this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));
		this.registerView(VIEW_TYPE_MINI, (leaf) => new MiniCalendarView(leaf, this));
		this.registerView(VIEW_TYPE_TASKS, (leaf) => new TasksView(leaf, this));
		this.addSettingTab(new OmniCalendarSettingTab(this.app, this));
		this.addRibbon();
		registerCommands(this);
		this.registerMarkdownCodeBlockProcessor("omni-calendar", (source, el, ctx) => ctx.addChild(new AgendaBlock(this, el, source)));
		this.followNoteChanges();

		this.app.workspace.onLayoutReady(async () => {
			await this.store.loadCached();
			if (this.firstRun) {
				this.settings.sidebarView = "mini";
			} else if (this.sidebarViewUnset) {
				// Upgrading from an older version: adopt whatever is in the sidebar now.
				this.settings.sidebarView = this.sidebar.actualView();
			}
			await this.persist();
			await this.sidebar.apply(false);
			await this.sidebar.applyTasks(false);
			// From now on keep the settings in sync when the user closes or drags our sidebar views.
			this.registerEvent(this.app.workspace.on("layout-change", () => this.sidebar.syncSetting()));
			void this.store.refreshAll();
			this.scheduleRefresh();
			// Automatic clean-up of completed tasks (if turned on): now and every few hours.
			void this.cleanUpDoneTasks();
			this.registerInterval(window.setInterval(() => void this.cleanUpDoneTasks(), 6 * MS_HOUR));
		});
	}

	onunload() {
		if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
	}

	private addRibbon() {
		// One fixed label on every device: Obsidian identifies ribbon buttons by their label,
		// so a changing label leaves a duplicate button behind (e.g. on mobile).
		const ribbon = this.addRibbonIcon("calendar-days", "Omni Calendar", (evt: MouseEvent) => {
			if (Platform.isMobile) {
				// Mobile ribbon buttons only receive taps (no long press / right-click):
				// a tap opens the menu, whose first entry opens the calendar.
				const x = evt?.clientX || window.innerWidth / 2;
				const y = evt?.clientY || window.innerHeight / 3;
				this.showCalendarMenu({ x, y });
				return;
			}
			void this.openCalendar();
		});
		ribbon.setAttr("aria-label", Platform.isMobile ? "Omni Calendar" : "Open calendar (right-click for more)");
		// Desktop: right-click opens the menu.
		ribbon.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			this.showCalendarMenu({ x: e.clientX, y: e.clientY });
		});
	}

	/** Keep linked note paths in sync when notes are renamed / deleted. */
	private followNoteChanges() {
		this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
			const events = this.store.renameLink(oldPath, file.path);
			const changed = this.tasks.renameLink(oldPath, file.path) || events;
			if (changed) await this.persist();
		}));
		this.registerEvent(this.app.vault.on("delete", async (file) => {
			const events = this.store.removeLink(file.path);
			const changed = this.tasks.removeLink(file.path) || events;
			if (changed) await this.persist();
		}));
	}

	// ------------------------------------------------------------------ data

	/** Read data.json; checks and migrations are in settingsData.ts. */
	private async loadPluginData() {
		const loaded = normalizePluginData((await this.loadData()) as Partial<PluginData> | null);
		this.data = loaded.data;
		this.settings = loaded.data.settings;
		this.firstRun = loaded.firstRun;
		this.sidebarViewUnset = loaded.sidebarViewUnset;
	}

	/** Called by Obsidian when data.json was changed externally (e.g. by Sync). */
	async onExternalSettingsChange() {
		await this.loadPluginData();
		this.store.notify();
		this.tasks?.trigger("changed");
	}

	async persist() {
		await this.saveData(this.data);
	}

	scheduleRefresh() {
		if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
		this.refreshTimer = null;
		const mins = this.settings.refreshIntervalMinutes;
		if (mins > 0) {
			this.refreshTimer = window.setInterval(() => void this.store.refreshAll(), mins * MS_MIN);
			this.registerInterval(this.refreshTimer);
		}
	}

	/** Re-download subscriptions and connected calendars, then say how it went. */
	async refreshCalendars() {
		await this.store.refreshAll();
		const errors = [...this.store.status.values()].filter((s) => s.error).length;
		new Notice(errors ? `Calendars refreshed – ${errors} failed (see settings)` : "Calendars refreshed");
	}

	/** Delete completed tasks older than the "Delete completed tasks after" setting (0 = never). */
	async cleanUpDoneTasks(): Promise<number> {
		const days = this.settings.tasksDeleteDoneAfterDays;
		if (!days || days < 1) return 0;
		return this.tasks.removeDoneBefore(Date.now() - days * MS_DAY);
	}

	// ------------------------------------------------------------------ menu

	/** The calendar quick menu (ribbon right-click / tap on mobile, or the "Calendar menu" command). */
	showCalendarMenu(pos: { x: number; y: number }) {
		// Right-click and long press can both fire on some phones – show the menu only once.
		if (Date.now() - this.ribbonMenuShownAt < 800) return;
		this.ribbonMenuShownAt = Date.now();
		const s = this.settings;
		const menu = new Menu();
		const item = (title: string, icon: string, run: () => void) => menu.addItem((i) => i.setTitle(title).setIcon(icon).onClick(run));
		item("Open calendar", "calendar-days", () => void this.openCalendar());
		item(`${s.sidebarView === "mini" ? "Hide" : "Show"} mini calendar in sidebar`, "panel-right", () => void this.sidebar.toggle("mini"));
		item(`${s.sidebarView === "full" ? "Hide" : "Show"} day planner in sidebar`, "panel-right-open", () => void this.sidebar.toggle("full"));
		if (s.tasksEnabled) {
			menu.addSeparator();
			item("Open tasks", "check-square", () => void this.openTasks());
			item(`${s.tasksSidebar ? "Hide" : "Show"} tasks in sidebar`, "list-checks", () => void this.sidebar.toggleTasks());
		}
		menu.addSeparator();
		item("New event", "plus", () => new EventModal(this, { start: startOfDay(new Date()) }).open());
		if (s.tasksEnabled) item("New task", "check-square", () => new TaskModal(this).open());
		menu.addSeparator();
		item("Settings", "settings", () => this.openSettings());
		menu.showAtPosition(pos);
	}

	// ------------------------------------------------------------------ opening pages

	/** A new tab in the main area, even if a sidebar view has focus. */
	mainAreaLeaf(): WorkspaceLeaf {
		const { workspace } = this.app;
		const recent = workspace.getMostRecentLeaf(workspace.rootSplit);
		if (recent && recent !== workspace.activeLeaf) workspace.setActiveLeaf(recent, { focus: false });
		return workspace.getLeaf("tab");
	}

	/** The open page of this view type in the main area (never one that sits in a sidebar). */
	private mainAreaPage(type: string): WorkspaceLeaf | null {
		return this.app.workspace.getLeavesOfType(type).find((l) => !this.sidebar.contains(l)) ?? null;
	}

	/** Open the calendar in the main area (reuses an open one; never takes over the day planner). */
	async openCalendar(date?: Date, mode?: ViewMode) {
		let leaf = this.mainAreaPage(VIEW_TYPE_CALENDAR);
		if (!leaf) {
			leaf = this.mainAreaLeaf();
			const state: Record<string, unknown> = {};
			if (mode) state.mode = mode;
			if (date) state.date = toDateKey(date);
			await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true, state });
		}
		await this.app.workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof CalendarView && (date || mode)) view.goTo(date ?? view.cursor, mode);
	}

	/** Open the Tasks page in the main area (reuses an open one). */
	async openTasks(list?: string) {
		let leaf = this.mainAreaPage(VIEW_TYPE_TASKS);
		if (!leaf) {
			leaf = this.mainAreaLeaf();
			await leaf.setViewState({ type: VIEW_TYPE_TASKS, active: true, state: list ? { list } : {} });
		}
		await this.app.workspace.revealLeaf(leaf);
		if (list && leaf.view instanceof TasksView) leaf.view.select(list);
	}

	/** Uses undocumented Obsidian internals (`app.setting`); does nothing if they are gone. */
	openSettings() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const setting = (this.app as any).setting;
		setting?.open?.();
		setting?.openTabById?.(this.manifest.id);
	}

	// ------------------------------------------------------------------ notes

	/** True when "Create note" would only open an existing note (the button then reads "Open note"). */
	hasEventNote(occ: CalendarOccurrence): boolean {
		return this.app.vault.getAbstractFileByPath(eventNotePath(occ, this.settings.notesFolder)) instanceof TFile;
	}

	/**
	 * "Create note" for an event: creates the note from the template (or finds the existing one),
	 * adds it to the event's linked notes and opens it.
	 */
	async createNoteForEvent(occ: CalendarOccurrence): Promise<TFile | null> {
		const file = await createEventNote(this.app, occ, {
			folder: this.settings.notesFolder,
			template: this.settings.noteTemplate,
			calendarName: this.store.getSource(occ.sourceId)?.name ?? "",
			use24h: this.settings.use24h,
		});
		if (!file) return null;
		await this.store.addLink(occ, file.path);
		await this.mainAreaLeaf().openFile(file);
		return file;
	}
}
