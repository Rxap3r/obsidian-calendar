import { Menu, setIcon, ViewStateResult } from "obsidian";
import { SmartListId, Task, TaskList } from "../types";
import { DEFAULT_TASK_LIST, SMART_LISTS, TaskGroup } from "../tasks";
import { addDays, MS_MIN, toDateKey } from "../dateUtils";
import { periodLabel } from "../periods";
import { plural } from "../util";
import { TaskModal } from "../modals/TaskModal";
import { ListModal } from "../modals/ListModal";
import { confirmAction } from "../modals/ConfirmModal";
import { deleteTaskList } from "../modals/confirmations";
import { OmniView } from "./OmniView";
import { renderTaskRow } from "./tasks/taskRow";
import { sideScroll } from "./sideScroll";
import { VIEW_TYPE_TASKS } from "./viewTypes";

/** Below this width the list navigation becomes a scrollable bar above the tasks. */
const NARROW = 620;

/** The Tasks page: lists on the left (a bar on top when narrow), the selected list's tasks on the right. */
export class TasksView extends OmniView {
	/** Selected list: a smart list id ("today", …) or a user list id. */
	selected: string = "today";
	private rootEl!: HTMLElement;
	private narrow = false;
	private stopScroll: (() => void) | null = null;
	private collapsedSubtasks = new Set<string>();
	/** "Show older" was clicked in the Done list / section (reset when another list is selected). */
	private showOlder = false;

	getViewType() {
		return VIEW_TYPE_TASKS;
	}
	getDisplayText() {
		return "Tasks";
	}
	getIcon() {
		return "check-square";
	}

	getState(): Record<string, unknown> {
		return { list: this.selected };
	}

	async setState(state: { list?: string }, result: ViewStateResult): Promise<void> {
		if (state?.list) this.selected = state.list;
		this.render();
		await super.setState(state, result);
	}

	async onOpen() {
		this.contentEl.empty();
		this.contentEl.addClass("ch-tasks-view");
		this.rootEl = this.contentEl.createDiv({ cls: "ch-tasks" });
		this.registerEvent(this.plugin.tasks.on("changed", () => this.queueRender()));
		// Moved between sidebar and main area: show / hide the "open Tasks page" button.
		this.registerEvent(this.app.workspace.on("layout-change", () => {
			if (this.inSidebar() !== this.rootEl.hasClass("ch-in-sidebar")) this.render();
		}));
		const ro = new ResizeObserver(() => {
			const n = this.contentEl.clientWidth > 0 && this.contentEl.clientWidth < NARROW;
			if (n !== this.narrow) {
				this.narrow = n;
				this.render();
			}
		});
		ro.observe(this.contentEl);
		this.register(() => ro.disconnect());
		// Re-group at midnight ("Tomorrow" becomes "Today").
		this.registerInterval(window.setInterval(() => this.render(), 10 * MS_MIN));
		this.narrow = this.contentEl.clientWidth > 0 && this.contentEl.clientWidth < NARROW;
		this.render();
	}

	async onClose() {
		this.stopScroll?.();
		this.contentEl.empty();
	}

	/** Select a list (smart list id or user list id). */
	select(id: string) {
		if (id !== this.selected) this.showOlder = false;
		this.selected = id;
		this.render();
		this.app.workspace.requestSaveLayout();
	}

	private listName(id: string): string {
		return SMART_LISTS.find((s) => s.id === id)?.name ?? this.plugin.tasks.lists.find((l) => l.id === id)?.name ?? "Tasks";
	}

	private isSmart(id: string): id is SmartListId {
		return SMART_LISTS.some((s) => s.id === id);
	}

	// ------------------------------------------------------------------ render

	render() {
		if (!this.rootEl) return;
		const store = this.plugin.tasks;
		if (!this.isSmart(this.selected) && !store.lists.some((l) => l.id === this.selected)) this.selected = "today";
		const scroll = this.rootEl.querySelector(".ch-tasks-main")?.scrollTop ?? 0;
		this.rootEl.empty();
		this.rootEl.toggleClass("ch-narrow", this.narrow);
		this.rootEl.toggleClass("ch-in-sidebar", this.inSidebar());

		if (!this.plugin.settings.tasksEnabled) {
			this.rootEl.createDiv({ cls: "ch-empty ch-tasks-off", text: "Tasks are turned off. Turn them on in Settings → Omni Calendar → Tasks." });
			return;
		}

		this.stopScroll?.();
		this.stopScroll = null;
		if (this.narrow) {
			// The list bar scrolls sideways: a thin scrollbar and the mouse wheel on desktop, swiping on the phone.
			const bar = this.rootEl.createDiv({ cls: "ch-tasks-bar" });
			this.renderNav(bar);
			this.stopScroll = sideScroll(bar);
		} else {
			this.renderNav(this.rootEl.createDiv({ cls: "ch-tasks-nav" }));
		}
		const main = this.rootEl.createDiv({ cls: "ch-tasks-main" });
		this.renderMain(main);
		main.scrollTop = scroll;
	}

	private renderNav(nav: HTMLElement) {
		const store = this.plugin.tasks;
		const item = (id: string, name: string, icon: string | null, color: string | null, count: number) => {
			const el = nav.createEl("button", { cls: "ch-tasks-nav-item", attr: { "data-list": id } });
			el.toggleClass("is-active", this.selected === id);
			if (icon) setIcon(el.createSpan({ cls: "ch-tasks-nav-icon" }), icon);
			if (color) el.createSpan({ cls: "ch-tasks-nav-dot" }).style.setProperty("--ch-event-color", color);
			el.createSpan({ cls: "ch-tasks-nav-name", text: name });
			if (count) el.createSpan({ cls: `ch-tasks-nav-count${id === "overdue" ? " ch-overdue" : ""}`, text: String(count) });
			el.onclick = () => this.select(id);
			return el;
		};
		for (const s of SMART_LISTS) {
			const n = store.count(s.id);
			// The narrow bar only shows Overdue when there is something overdue.
			if (this.narrow && s.id === "overdue" && !n && this.selected !== "overdue") continue;
			item(s.id, s.name, s.icon, null, n);
		}
		if (!this.narrow) {
			const head = nav.createDiv({ cls: "ch-tasks-nav-head" });
			head.createSpan({ text: "My lists" });
			const add = head.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "New list" } });
			setIcon(add, "plus");
			add.onclick = () => this.editList();
		} else {
			nav.createDiv({ cls: "ch-tasks-bar-sep" });
		}
		for (const l of store.lists) {
			const el = item(l.id, l.name, null, l.color, store.count(l.id));
			el.addEventListener("contextmenu", (e) => {
				e.preventDefault();
				this.listMenu(l, e);
			});
		}
		if (this.narrow) {
			const add = nav.createEl("button", { cls: "ch-tasks-nav-item ch-tasks-nav-add", attr: { "aria-label": "New list" } });
			setIcon(add, "plus");
			add.onclick = () => this.editList();
		}
		if (this.narrow) {
			window.requestAnimationFrame(() => nav.querySelector<HTMLElement>(".is-active")?.scrollIntoView({ block: "nearest", inline: "nearest" }));
		}
	}

	private renderMain(main: HTMLElement) {
		const store = this.plugin.tasks;
		const s = this.plugin.settings;
		const id = this.selected;
		const userList = store.lists.find((l) => l.id === id);

		const head = main.createDiv({ cls: "ch-tasks-head" });
		const title = head.createDiv({ cls: "ch-tasks-title" });
		if (userList) title.createSpan({ cls: "ch-tasks-nav-dot" }).style.setProperty("--ch-event-color", userList.color);
		title.createSpan({ text: this.listName(id) });
		if (id === "done" && s.tasksDoneVisibleDays > 0 && !this.showOlder) {
			title.createSpan({ cls: "ch-tasks-title-sub", text: `last ${periodLabel(s.tasksDoneVisibleDays)}` });
		}
		if (id === "upcoming") {
			title.createSpan({ cls: "ch-tasks-title-sub", text: `next ${periodLabel(store.upcomingDays)}` });
		}
		if (userList) {
			const more = head.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "List options" } });
			setIcon(more, "more-horizontal");
			more.onclick = (e) => this.listMenu(userList, e);
		}
		if (this.inSidebar()) {
			// Like the day planner's ⤢: open the full Tasks page with the same list.
			const full = head.createEl("button", { cls: "ch-icon-btn ch-tasks-open-full", attr: { "aria-label": "Open Tasks page" } });
			setIcon(full, "maximize-2");
			full.onclick = () => void this.plugin.openTasks(this.selected);
		}
		const add = head.createEl("button", { cls: "mod-cta ch-tasks-new", attr: { "aria-label": "New task" } });
		setIcon(add.createSpan({ cls: "ch-btn-icon" }), "plus");
		add.createSpan({ cls: "ch-new-label", text: "New task" });
		add.onclick = () => new TaskModal(this.plugin, undefined, this.defaultsForList()).open();

		if (id !== "done") {
			const quick = main.createEl("input", { type: "text", cls: "ch-input ch-tasks-quick", attr: { placeholder: this.narrow ? "Add a task…" : `Add a task to “${this.listName(id)}” and press Enter` } });
			quick.addEventListener("keydown", (e) => {
				if (e.key !== "Enter") return;
				e.preventDefault();
				const title = quick.value.trim();
				if (!title) return;
				quick.value = "";
				void store.upsert(store.draft({ ...this.defaultsForList(), title })).then(() => {
					window.requestAnimationFrame(() => this.rootEl.querySelector<HTMLInputElement>(".ch-tasks-quick")?.focus());
				});
			});
		}

		const open = store.tasksFor(id);
		const allDone = id === "done" ? store.tasksFor("done") : s.tasksShowCompleted ? store.doneFor(id) : [];
		// Only recently completed tasks are shown; older ones behind "Show older".
		const { recent, older } = store.splitDone(allDone);
		const done = this.showOlder ? allDone : recent;
		const byCompletion = (a: Task, b: Task) => (b.completedAt ?? 0) - (a.completedAt ?? 0);
		const groups: TaskGroup[] = id === "done"
			? [{ key: "done", title: "Done", tasks: [...done].sort(byCompletion) }]
			: store.group(open, done);
		if (id !== "done" && older.length && !groups.some((g) => g.key === "~~done")) {
			groups.push({ key: "~~done", title: "Done", tasks: [], collapsed: true });
		}

		if (!open.length && id !== "done") {
			main.createDiv({ cls: "ch-empty ch-tasks-empty", text: id === "today" ? "Nothing to do today 🎉" : "No open tasks here." });
		}
		if (id === "done" && !allDone.length) main.createDiv({ cls: "ch-empty ch-tasks-empty", text: "No completed tasks yet." });
		else if (id === "done" && !done.length) main.createDiv({ cls: "ch-empty ch-tasks-empty", text: `Nothing completed in the last ${periodLabel(s.tasksDoneVisibleDays)}.` });

		for (const g of groups) {
			const isDone = g.key === "~~done" || g.key === "done";
			if (!g.tasks.length && !(isDone && (older.length || (id === "done" && allDone.length)))) continue;
			let body: HTMLElement;
			if (g.collapsed) {
				const det = main.createEl("details", { cls: "ch-tasks-group ch-tasks-done-group" });
				const sum = det.createEl("summary", { cls: "ch-tasks-group-head" });
				sum.createSpan({ text: g.title });
				sum.createSpan({ cls: "ch-tasks-group-count", text: String(g.tasks.length) });
				body = det;
			} else {
				const grp = main.createDiv({ cls: "ch-tasks-group" });
				// Upcoming / list views: one heading per day; "Today" list: only Overdue + Today.
				const gh = grp.createDiv({ cls: `ch-tasks-group-head${g.overdue ? " ch-overdue" : ""}` });
				gh.createSpan({ text: g.title });
				gh.createSpan({ cls: "ch-tasks-group-count", text: String(g.tasks.length) });
				body = grp;
			}
			const showDate = g.key === "!overdue" || g.key === "}later" || isDone;
			for (const t of g.tasks) {
				renderTaskRow(this.plugin, body, t, {
					showDate,
					// The list name only helps when tasks of several lists are shown.
					showList: this.isSmart(id) || id !== t.listId,
					collapsed: this.collapsedSubtasks.has(t.id),
					onToggleSubtasks: () => this.toggleSubtasks(t.id),
				});
			}
			if (isDone) this.renderDoneFooter(body, id, older.length, allDone.length);
		}
	}

	/** Under the completed tasks: "Show N older" / "Show only recent", and "Clear completed". */
	private renderDoneFooter(body: HTMLElement, id: string, olderCount: number, total: number) {
		const store = this.plugin.tasks;
		const foot = body.createDiv({ cls: "ch-tasks-done-foot" });
		if (olderCount) {
			const more = foot.createEl("button", { cls: "ch-tasks-link", text: this.showOlder ? "Show only recent" : `Show ${olderCount} older` });
			more.onclick = () => {
				this.showOlder = !this.showOlder;
				this.render();
			};
		}
		const userList = store.lists.find((l) => l.id === id);
		if (total && (id === "done" || id === "all" || userList)) {
			const clear = foot.createEl("button", { cls: "ch-tasks-link ch-tasks-clear", text: "Clear completed" });
			clear.onclick = async () => {
				const where = userList ? ` in “${userList.name}”` : "";
				const ok = await confirmAction(this.app, "Clear completed tasks", `Delete all ${plural(total, "completed task")}${where}? This can't be undone.`);
				if (ok) await store.clearDone(userList?.id);
			};
		}
		if (!foot.childElementCount) foot.remove();
	}

	private toggleSubtasks(taskId: string) {
		if (!this.collapsedSubtasks.delete(taskId)) this.collapsedSubtasks.add(taskId);
		this.render();
	}

	/** Defaults for a task created while this list is selected. */
	private defaultsForList(): Partial<Task> {
		const today = new Date();
		switch (this.selected) {
			case "today":
			case "overdue":
			case "upcoming":
				return { date: toDateKey(today) };
			case "tomorrow":
				return { date: toDateKey(addDays(today, 1)) };
			case "nodate":
			case "all":
			case "done":
				return {};
		}
		return { listId: this.selected };
	}

	// ------------------------------------------------------------------ menus

	private listMenu(l: TaskList, e: MouseEvent) {
		const menu = new Menu();
		menu.addItem((i) => i.setTitle("Rename / colour…").setIcon("pencil").onClick(() => this.editList(l)));
		if (l.id !== DEFAULT_TASK_LIST.id) {
			menu.addItem((i) =>
				i.setTitle("Delete list").setIcon("trash").setWarning(true).onClick(async () => {
					if ((await deleteTaskList(this.plugin, l)) && this.selected === l.id) this.select("today");
				})
			);
		}
		menu.showAtMouseEvent(e);
	}

	/** Create a list (no argument) or rename / recolour one. */
	private editList(l?: TaskList) {
		new ListModal(this.plugin, l, (created) => {
			if (created) this.select(created.id);
		}).open();
	}
}
