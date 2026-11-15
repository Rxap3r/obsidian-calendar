import { ItemView, Menu, Modal, Notice, Setting, setIcon, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { SmartListId, Task, TaskList, TaskPriority } from "../types";
import { DEFAULT_TASK_LIST, PRIORITY_NAMES, SMART_LISTS, TaskGroup } from "../tasks";
import { addDays, formatDate, parseLocal, toDateKey } from "../dateUtils";
import { TaskModal } from "../modals/TaskModal";
import { confirmAction } from "../modals/ConfirmModal";
import { PALETTE } from "../settings";

export const VIEW_TYPE_TASKS = "omni-calendar-tasks";

/** Below this width the list navigation becomes a scrollable bar above the tasks. */
const NARROW = 620;

/** Open a linked note in the main area (in a new tab). */
export async function openLinkedNote(plugin: OmniCalendarPlugin, path: string) {
	const file = plugin.app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) {
		new Notice("This note doesn't exist any more.");
		return;
	}
	await plugin.mainAreaLeaf().openFile(file);
}

/** "10:30–11:00", "10:30" or "". */
export function taskTimeLabel(t: Task): string {
	if (!t.start) return "";
	return t.end ? `${t.start}–${t.end}` : t.start;
}

/** The Tasks page: lists on the left (a bar on top when narrow), the selected list's tasks on the right. */
export class TasksView extends ItemView {
	/** Selected list: a smart list id ("today", …) or a user list id. */
	selected: string = "today";
	private rootEl!: HTMLElement;
	private narrow = false;
	private collapsedSubtasks = new Set<string>();
	private renderQueued = false;

	constructor(leaf: WorkspaceLeaf, private plugin: OmniCalendarPlugin) {
		super(leaf);
	}

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
		this.registerInterval(window.setInterval(() => this.render(), 10 * 60 * 1000));
		this.narrow = this.contentEl.clientWidth > 0 && this.contentEl.clientWidth < NARROW;
		this.render();
	}

	async onClose() {
		this.contentEl.empty();
	}

	/** Select a list (smart list id or user list id). */
	select(id: string) {
		this.selected = id;
		this.render();
		this.app.workspace.requestSaveLayout();
	}

	private queueRender() {
		if (this.renderQueued) return;
		this.renderQueued = true;
		window.requestAnimationFrame(() => {
			this.renderQueued = false;
			this.render();
		});
	}

	private inSidebar(): boolean {
		try {
			return this.plugin.isInSidebar(this.leaf);
		} catch {
			return false;
		}
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

		this.renderNav(this.rootEl.createDiv({ cls: this.narrow ? "ch-tasks-bar" : "ch-tasks-nav" }));
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
		const done = id === "done" ? store.tasksFor("done") : s.tasksShowCompleted ? store.doneFor(id) : [];
		const groups: TaskGroup[] = id === "done"
			? [{ key: "done", title: "Done", tasks: [...done].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)) }]
			: store.group(open, done);

		if (!open.length && id !== "done") {
			main.createDiv({ cls: "ch-empty ch-tasks-empty", text: id === "today" ? "Nothing to do today 🎉" : "No open tasks here." });
		}
		if (id === "done" && !done.length) main.createDiv({ cls: "ch-empty ch-tasks-empty", text: "No completed tasks yet." });

		for (const g of groups) {
			if (!g.tasks.length) continue;
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
			const showDate = g.key === "!overdue" || g.key === "}later" || g.key === "~~done" || g.key === "done";
			for (const t of g.tasks) this.renderTask(body, t, showDate);
		}
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

	private renderTask(parent: HTMLElement, t: Task, showDate: boolean) {
		const store = this.plugin.tasks;
		const list = store.list(t.listId);
		const row = parent.createDiv({ cls: "ch-task", attr: { "data-task": t.id } });
		row.style.setProperty("--ch-event-color", list.color);
		row.toggleClass("is-done", t.done);
		row.addClass(`ch-prio-${t.priority}`);

		const line = row.createDiv({ cls: "ch-task-line" });
		const check = line.createEl("button", { cls: "ch-task-checkbox", attr: { role: "checkbox", "aria-checked": String(t.done), "aria-label": t.done ? "Mark as not done" : "Mark as done" } });
		if (t.done) setIcon(check, "check");
		check.onclick = (e) => {
			e.stopPropagation();
			void store.setDone(t.id, !t.done);
		};

		const body = line.createDiv({ cls: "ch-task-body" });
		body.createDiv({ cls: "ch-task-title", text: t.title });
		const meta = body.createDiv({ cls: "ch-task-meta" });
		const time = taskTimeLabel(t);
		if (showDate && t.date) meta.createSpan({ cls: "ch-task-meta-date", text: formatDate(parseLocal(t.date), { weekday: "short", day: "numeric", month: "short" }) });
		if (time) {
			const m = meta.createSpan({ cls: "ch-task-meta-time" });
			setIcon(m.createSpan({ cls: "ch-task-meta-icon" }), "clock");
			m.appendText(time);
		}
		// The list name only helps when there is more than one list.
		if (store.lists.length > 1 && (this.isSmart(this.selected) || this.selected !== t.listId)) {
			const m = meta.createSpan({ cls: "ch-task-meta-list" });
			m.createSpan({ cls: "ch-tasks-nav-dot" });
			m.appendText(list.name);
		}
		if (t.subtasks.length) {
			const doneN = t.subtasks.filter((s) => s.done).length;
			const m = meta.createSpan({ cls: "ch-task-meta-subs", attr: { "aria-label": "Show or hide subtasks" } });
			setIcon(m.createSpan({ cls: "ch-task-meta-icon" }), this.collapsedSubtasks.has(t.id) ? "chevron-right" : "chevron-down");
			m.appendText(`${doneN}/${t.subtasks.length}`);
			m.onclick = (e) => {
				e.stopPropagation();
				if (this.collapsedSubtasks.has(t.id)) this.collapsedSubtasks.delete(t.id);
				else this.collapsedSubtasks.add(t.id);
				this.render();
			};
		}
		if (t.notes) setIcon(meta.createSpan({ cls: "ch-task-meta-icon ch-task-has-notes", attr: { "aria-label": "Has notes" } }), "align-left");
		if (!meta.childElementCount) meta.remove();

		if (t.priority > 0) {
			const flag = line.createSpan({ cls: "ch-task-prio", attr: { "aria-label": `${PRIORITY_NAMES[t.priority]} priority` }, text: "!".repeat(t.priority) });
			flag.addClass(`ch-prio-${t.priority}`);
		}

		// Subtasks (one level), shown inline and tickable.
		if (t.subtasks.length && !this.collapsedSubtasks.has(t.id)) {
			const subs = row.createDiv({ cls: "ch-task-subs" });
			for (const s of t.subtasks) {
				const sr = subs.createDiv({ cls: "ch-task-sub" });
				sr.toggleClass("is-done", s.done);
				const cb = sr.createEl("button", { cls: "ch-task-checkbox ch-small", attr: { role: "checkbox", "aria-checked": String(s.done) } });
				if (s.done) setIcon(cb, "check");
				cb.onclick = (e) => {
					e.stopPropagation();
					void store.setSubtaskDone(t.id, s.id, !s.done);
				};
				sr.createSpan({ cls: "ch-task-sub-title", text: s.title });
				sr.onclick = (e) => e.stopPropagation();
			}
		}

		// Linked notes as small clickable chips.
		if (t.links.length) {
			const links = row.createDiv({ cls: "ch-task-linkchips" });
			for (const path of t.links) {
				const chip = links.createEl("a", { cls: "ch-task-linkchip", attr: { title: path } });
				setIcon(chip.createSpan({ cls: "ch-task-meta-icon" }), "file-text");
				chip.appendText(path.replace(/\.md$/, "").split("/").pop() ?? path);
				chip.onclick = (e) => {
					e.preventDefault();
					e.stopPropagation();
					void openLinkedNote(this.plugin, path);
				};
			}
		}

		row.onclick = () => new TaskModal(this.plugin, t).open();
		row.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			this.taskMenu(t, e);
		});
	}

	// ------------------------------------------------------------------ menus

	private taskMenu(t: Task, e: MouseEvent) {
		const store = this.plugin.tasks;
		const menu = new Menu();
		const today = new Date();
		const when = (title: string, icon: string, date: string | undefined) =>
			menu.addItem((i) => i.setTitle(title).setIcon(icon).onClick(() => void store.update(t.id, { date })));
		menu.addItem((i) => i.setTitle(t.done ? "Mark as not done" : "Mark as done").setIcon("check").onClick(() => void store.setDone(t.id, !t.done)));
		menu.addItem((i) => i.setTitle("Edit…").setIcon("pencil").onClick(() => new TaskModal(this.plugin, t).open()));
		menu.addSeparator();
		when("Today", "sun", toDateKey(today));
		when("Tomorrow", "sunrise", toDateKey(addDays(today, 1)));
		when("Next week", "calendar-range", toDateKey(addDays(today, 7)));
		when("No date", "inbox", undefined);
		menu.addSeparator();
		([3, 2, 1, 0] as TaskPriority[]).forEach((p) =>
			menu.addItem((i) =>
				i.setTitle(`Priority: ${PRIORITY_NAMES[p]}`).setIcon("flag").setChecked(t.priority === p).onClick(() => void store.update(t.id, { priority: p }))
			)
		);
		menu.addSeparator();
		menu.addItem((i) =>
			i.setTitle("Delete").setIcon("trash").setWarning(true).onClick(async () => {
				if (await confirmAction(this.app, "Delete task", `Delete “${t.title}”?`)) await store.remove(t.id);
			})
		);
		menu.showAtMouseEvent(e);
	}

	private listMenu(l: TaskList, e: MouseEvent) {
		const menu = new Menu();
		menu.addItem((i) => i.setTitle("Rename / colour…").setIcon("pencil").onClick(() => this.editList(l)));
		if (l.id !== DEFAULT_TASK_LIST.id) {
			menu.addItem((i) =>
				i.setTitle("Delete list").setIcon("trash").setWarning(true).onClick(async () => {
					const n = this.plugin.tasks.items.filter((t) => t.listId === l.id).length;
					const msg = n ? `Delete “${l.name}”? Its ${n} task${n === 1 ? "" : "s"} will move to “${DEFAULT_TASK_LIST.name}”.` : `Delete “${l.name}”?`;
					if (await confirmAction(this.app, "Delete list", msg)) {
						await this.plugin.tasks.removeList(l.id);
						if (this.selected === l.id) this.select("today");
					}
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

/** Small dialog: list name + colour. */
export class ListModal extends Modal {
	private name: string;
	private color: string;
	constructor(private plugin: OmniCalendarPlugin, private list: TaskList | undefined, private done: (created?: TaskList) => void) {
		super(plugin.app);
		this.name = list?.name ?? "";
		const used = new Set(plugin.tasks.lists.map((x) => x.color));
		this.color = list?.color ?? PALETTE.find((c) => !used.has(c)) ?? PALETTE[plugin.tasks.lists.length % PALETTE.length];
	}
	onOpen() {
		this.setTitle(this.list ? "Edit list" : "New list");
		this.modalEl.addClass("ch-list-modal");
		new Setting(this.contentEl).setName("Name").addText((t) => {
			t.setPlaceholder("e.g. Work").setValue(this.name).onChange((v) => (this.name = v));
			t.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					void this.save();
				}
			});
			window.setTimeout(() => t.inputEl.focus(), 10);
		});
		new Setting(this.contentEl).setName("Colour").addColorPicker((c) => c.setValue(this.color).onChange((v) => (this.color = v)));
		new Setting(this.contentEl)
			.setClass("ch-modal-buttons")
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((b) => b.setButtonText(this.list ? "Save" : "Create").setCta().onClick(() => void this.save()));
	}
	onClose() {
		this.contentEl.empty();
	}
	private async save() {
		const name = this.name.trim();
		if (!name) {
			new Notice("Please enter a name.");
			return;
		}
		if (this.list) {
			await this.plugin.tasks.updateList(this.list.id, { name, color: this.color });
			this.done();
		} else {
			this.done(await this.plugin.tasks.addList(name, this.color));
		}
		this.close();
	}
}
