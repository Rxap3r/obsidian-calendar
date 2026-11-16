import { Menu, setIcon } from "obsidian";
import type OmniCalendarPlugin from "../../main";
import { Task, TaskPriority } from "../../types";
import { PRIORITY_NAMES } from "../../tasks";
import { addDays, formatDate, parseLocal, toDateKey } from "../../dateUtils";
import { TaskModal } from "../../modals/TaskModal";
import { confirmAction } from "../../modals/ConfirmModal";
import { noteName, openLinkedNote, taskTimeLabel } from "./helpers";

export interface TaskRowOptions {
	/** Show the task's date (in groups that mix several days: Overdue, Later, Done). */
	showDate: boolean;
	/** Show the name of the task's list (when the page shows tasks of several lists). */
	showList: boolean;
	/** The subtasks are folded away. */
	collapsed: boolean;
	onToggleSubtasks: () => void;
}

/** One task in a list: checkbox, title, details line, subtasks and linked notes. A click opens the task dialog. */
export function renderTaskRow(plugin: OmniCalendarPlugin, parent: HTMLElement, t: Task, opts: TaskRowOptions): HTMLElement {
	const store = plugin.tasks;
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
	if (opts.showDate && t.date) meta.createSpan({ cls: "ch-task-meta-date", text: formatDate(parseLocal(t.date), { weekday: "short", day: "numeric", month: "short" }) });
	if (time) {
		const m = meta.createSpan({ cls: "ch-task-meta-time" });
		setIcon(m.createSpan({ cls: "ch-task-meta-icon" }), "clock");
		m.appendText(time);
	}
	// The list name only helps when there is more than one list.
	if (opts.showList && store.lists.length > 1) {
		const m = meta.createSpan({ cls: "ch-task-meta-list" });
		m.createSpan({ cls: "ch-tasks-nav-dot" });
		m.appendText(list.name);
	}
	if (t.subtasks.length) {
		const doneN = t.subtasks.filter((s) => s.done).length;
		const m = meta.createSpan({ cls: "ch-task-meta-subs", attr: { "aria-label": "Show or hide subtasks" } });
		setIcon(m.createSpan({ cls: "ch-task-meta-icon" }), opts.collapsed ? "chevron-right" : "chevron-down");
		m.appendText(`${doneN}/${t.subtasks.length}`);
		m.onclick = (e) => {
			e.stopPropagation();
			opts.onToggleSubtasks();
		};
	}
	if (t.notes) setIcon(meta.createSpan({ cls: "ch-task-meta-icon ch-task-has-notes", attr: { "aria-label": "Has notes" } }), "align-left");
	if (!meta.childElementCount) meta.remove();

	if (t.priority > 0) {
		const flag = line.createSpan({ cls: "ch-task-prio", attr: { "aria-label": `${PRIORITY_NAMES[t.priority]} priority` }, text: "!".repeat(t.priority) });
		flag.addClass(`ch-prio-${t.priority}`);
	}

	// Subtasks (one level), shown inline and tickable.
	if (t.subtasks.length && !opts.collapsed) {
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
			chip.appendText(noteName(path));
			chip.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				void openLinkedNote(plugin, path);
			};
		}
	}

	row.onclick = () => new TaskModal(plugin, t).open();
	row.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		taskMenu(plugin, t, e);
	});
	return row;
}

/** Right-click menu of a task. Everything in it is also reachable by tapping, through the task dialog. */
export function taskMenu(plugin: OmniCalendarPlugin, t: Task, e: MouseEvent) {
	const store = plugin.tasks;
	const menu = new Menu();
	const today = new Date();
	const when = (title: string, icon: string, date: string | undefined) =>
		menu.addItem((i) => i.setTitle(title).setIcon(icon).onClick(() => void store.update(t.id, { date })));
	menu.addItem((i) => i.setTitle(t.done ? "Mark as not done" : "Mark as done").setIcon("check").onClick(() => void store.setDone(t.id, !t.done)));
	menu.addItem((i) => i.setTitle("Edit…").setIcon("pencil").onClick(() => new TaskModal(plugin, t).open()));
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
			if (await confirmAction(plugin.app, "Delete task", `Delete “${t.title}”?`)) await store.remove(t.id);
		})
	);
	menu.showAtMouseEvent(e);
}
