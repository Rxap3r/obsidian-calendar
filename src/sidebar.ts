import { Platform, WorkspaceLeaf, WorkspaceSidedock } from "obsidian";
import type OmniCalendarPlugin from "./main";
import { SidebarView, ViewMode } from "./types";
import { VIEW_TYPE_CALENDAR, VIEW_TYPE_MINI, VIEW_TYPE_TASKS } from "./views/viewTypes";

/** How long layout changes are ignored after the plugin changed the sidebar itself (they arrive late). */
const SETTLE_MS = 300;

/**
 * Everything about the plugin's views in the left / right sidebar: the mini calendar, the day planner
 * (the calendar view in a sidebar) and the Tasks page. Keeps the sidebar and the settings in step, in
 * both directions.
 */
export class SidebarManager {
	/** True while the plugin itself changes the sidebar (those layout changes are ignored). */
	private busy = false;

	constructor(private plugin: OmniCalendarPlugin) {}

	private get app() {
		return this.plugin.app;
	}
	private get settings() {
		return this.plugin.settings;
	}

	/** Run a change to the sidebar without `syncSetting` mistaking it for something the user did. */
	private async quietly(change: () => Promise<void>) {
		this.busy = true;
		try {
			await change();
		} finally {
			// layout-change fires asynchronously; ignore it until things settled.
			window.setTimeout(() => (this.busy = false), SETTLE_MS);
		}
	}

	// ------------------------------------------------------------------ where things are

	/** True when the leaf lives in the left or right sidebar (not the main editor area). */
	contains(leaf: WorkspaceLeaf): boolean {
		const { workspace } = this.app;
		const root = leaf.getRoot();
		return root === workspace.leftSplit || root === workspace.rightSplit;
	}

	/** The sidebar leaves of one view type. */
	leaves(type: string): WorkspaceLeaf[] {
		return this.app.workspace.getLeavesOfType(type).filter((l) => this.contains(l));
	}

	/** The sidebar chosen in settings. */
	private configured() {
		const { workspace } = this.app;
		return this.settings.sidebarSide === "left" ? workspace.leftSplit : workspace.rightSplit;
	}

	private newLeaf(): WorkspaceLeaf | null {
		const { workspace } = this.app;
		return this.settings.sidebarSide === "left" ? workspace.getLeftLeaf(false) : workspace.getRightLeaf(false);
	}

	/** What is actually in the sidebar right now. */
	actualView(): SidebarView {
		if (this.leaves(VIEW_TYPE_MINI).length) return "mini";
		if (this.leaves(VIEW_TYPE_CALENDAR).length) return "full";
		return "none";
	}

	/** The tabs (views) currently in the configured sidebar, except our own – for the settings dropdown. */
	otherTabs(): { type: string; name: string }[] {
		const target = this.configured();
		const out: { type: string; name: string }[] = [];
		this.app.workspace.iterateAllLeaves((leaf) => {
			const type = leaf.getViewState().type;
			if (leaf.getRoot() !== target || !type || type === "empty" || type === VIEW_TYPE_MINI || type === VIEW_TYPE_CALENDAR) return;
			if (out.some((o) => o.type === type)) return;
			out.push({ type, name: leaf.getDisplayText() || type });
		});
		return out;
	}

	// ------------------------------------------------------------------ mini calendar / day planner

	/**
	 * Make the sidebar match the settings: right kind of calendar, on the right side, nothing else.
	 * Called on startup and whenever the sidebar settings change.
	 */
	async apply(reveal: boolean) {
		await this.quietly(async () => {
			await this.enforceSide();
			const want = this.settings.sidebarView;
			if (want !== "mini") this.detachAll(VIEW_TYPE_MINI);
			if (want !== "full") this.detachAll(VIEW_TYPE_CALENDAR);
			if (want !== "none") await this.show(want, reveal);
		});
	}

	/** Show the mini calendar / day planner in the sidebar, or hide it if it is already shown. */
	async toggle(kind: "mini" | "full") {
		this.settings.sidebarView = this.settings.sidebarView === kind ? "none" : kind;
		await this.plugin.persist();
		await this.apply(true);
	}

	/** Show the mini calendar in the sidebar (command "Show mini calendar in sidebar"). */
	async showMini(reveal: boolean) {
		this.settings.sidebarView = "mini";
		await this.plugin.persist();
		await this.apply(reveal);
	}

	/** "Move to sidebar" button of the calendar: the sidebar now holds the day planner. */
	async moveCalendarIn(state: Record<string, unknown>) {
		this.settings.sidebarView = "full";
		await this.plugin.persist();
		await this.quietly(async () => {
			this.detachAll(VIEW_TYPE_MINI);
			this.detachAll(VIEW_TYPE_CALENDAR);
			await this.show("full", true, state);
		});
	}

	/**
	 * ⤢ button of the day planner: open the calendar page, then (per setting) switch the sidebar
	 * to the mini calendar, close the day planner, or keep it.
	 */
	async expand(planner: WorkspaceLeaf, date: Date, mode: ViewMode) {
		const after = this.settings.sidebarOnExpand;
		if (after !== "keep") {
			// Change the sidebar first, in place: the day planner's own tab becomes the mini
			// calendar, so it stays the visible tab (instead of Obsidian showing e.g. Bookmarks).
			await this.quietly(async () => {
				this.settings.sidebarView = after === "mini" ? "mini" : "none";
				await this.plugin.persist();
				for (const leaf of this.leaves(VIEW_TYPE_CALENDAR)) if (leaf !== planner) leaf.detach();
				if (after === "mini") {
					this.detachAll(VIEW_TYPE_MINI);
					await planner.setViewState({ type: VIEW_TYPE_MINI, active: false, state: {} });
				} else {
					const root = planner.getRoot();
					planner.detach();
					this.selectTabOfType(root, this.settings.sidebarAfterClose);
				}
			});
		}
		await this.plugin.openCalendar(date, mode);
	}

	private detachAll(type: string) {
		for (const leaf of this.leaves(type)) leaf.detach();
	}

	/** Put the mini calendar or day planner into the sidebar (or reveal it if it is already there). */
	private async show(kind: "mini" | "full", reveal: boolean, state?: Record<string, unknown>) {
		const type = kind === "mini" ? VIEW_TYPE_MINI : VIEW_TYPE_CALENDAR;
		const target = this.configured();
		let leaf = this.leaves(type).find((l) => l.getRoot() === target);
		if (!leaf) {
			const created = this.newLeaf();
			if (!created) return;
			leaf = created;
			await leaf.setViewState({ type, active: reveal, state: state ?? (kind === "full" ? { mode: this.settings.sidebarCalendarMode } : {}) });
		}
		if (reveal) await this.app.workspace.revealLeaf(leaf);
		else this.selectTab(leaf);
	}

	/** Move calendar views that sit in the other sidebar into the configured one. */
	private async enforceSide() {
		const target = this.configured();
		for (const type of [VIEW_TYPE_MINI, VIEW_TYPE_CALENDAR]) {
			const leaves = this.leaves(type);
			const alreadyThere = leaves.some((l) => l.getRoot() === target);
			for (const leaf of leaves) {
				if (leaf.getRoot() === target) continue;
				const state = leaf.getViewState();
				const sourceOpen = !(leaf.getRoot() as WorkspaceSidedock).collapsed;
				leaf.detach();
				if (alreadyThere) continue; // never create a duplicate
				const moved = this.newLeaf();
				if (!moved) continue;
				await moved.setViewState({ ...state, active: false });
				if (sourceOpen) this.selectTab(moved);
			}
		}
	}

	// ------------------------------------------------------------------ tasks

	/** Show / hide the Tasks page in the sidebar (independent of the mini calendar / day planner). */
	async toggleTasks() {
		this.settings.tasksSidebar = !this.settings.tasksSidebar;
		await this.plugin.persist();
		await this.applyTasks(this.settings.tasksSidebar);
	}

	/** Make the sidebar match the tasks settings (on/off, main switch, side). */
	async applyTasks(reveal: boolean) {
		await this.quietly(async () => {
			const s = this.settings;
			if (!s.tasksEnabled) {
				// Main switch off: close every tasks page (nothing is deleted).
				for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TASKS)) leaf.detach();
				return;
			}
			if (!s.tasksSidebar) {
				this.detachAll(VIEW_TYPE_TASKS);
				return;
			}
			const target = this.configured();
			for (const leaf of this.leaves(VIEW_TYPE_TASKS)) if (leaf.getRoot() !== target) leaf.detach();
			let leaf = this.leaves(VIEW_TYPE_TASKS)[0];
			if (!leaf) {
				const created = this.newLeaf();
				if (!created) return;
				leaf = created;
				await leaf.setViewState({ type: VIEW_TYPE_TASKS, active: reveal, state: { list: "today" } });
			}
			if (reveal) await this.app.workspace.revealLeaf(leaf);
			else this.selectTab(leaf);
		});
	}

	// ------------------------------------------------------------------ following the user

	/** The user closed or dragged one of our sidebar views: update the settings to match. */
	syncSetting() {
		if (this.busy) return;
		const s = this.settings;
		let changed = false;
		const tasksThere = this.leaves(VIEW_TYPE_TASKS).length > 0;
		if (s.tasksEnabled && tasksThere !== s.tasksSidebar) {
			s.tasksSidebar = tasksThere;
			changed = true;
		}
		const actual = this.actualView();
		if (actual !== s.sidebarView) {
			s.sidebarView = actual;
			changed = true;
		}
		if (actual !== "none") {
			const leaf = this.leaves(actual === "mini" ? VIEW_TYPE_MINI : VIEW_TYPE_CALENDAR)[0];
			const side = leaf && leaf.getRoot() === this.app.workspace.leftSplit ? "left" : "right";
			if (leaf && side !== s.sidebarSide) {
				s.sidebarSide = side;
				changed = true;
			}
		}
		if (changed) void this.plugin.persist();
	}

	// ------------------------------------------------------------------ selecting tabs quietly

	/** Make the sidebar tab of this view type the visible one, without opening a collapsed sidebar (or the mobile drawer). */
	private selectTabOfType(root: unknown, type: string) {
		if (!type) return;
		let found: WorkspaceLeaf | null = null;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!found && leaf.getRoot() === root && leaf.getViewState().type === type) found = leaf;
		});
		if (found) this.selectTab(found);
	}

	/**
	 * Make a sidebar leaf the visible tab of its tab group without focusing it, opening a
	 * collapsed sidebar or the mobile drawer, or closing the settings window.
	 * Uses an undocumented Obsidian internal (`leaf.parent.selectTab`), with `revealLeaf` as the fallback.
	 */
	private selectTab(leaf: WorkspaceLeaf) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tabs = (leaf as any).parent;
		if (tabs && typeof tabs.selectTab === "function") tabs.selectTab(leaf);
		else if (!Platform.isMobile && !(leaf.getRoot() as WorkspaceSidedock).collapsed) void this.app.workspace.revealLeaf(leaf);
	}
}
