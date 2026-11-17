import { Menu, setIcon } from "obsidian";
import type OmniCalendarPlugin from "../../main";
import { Task, TaskPriority } from "../../types";
import { PRIORITY_NAMES } from "../../tasks";
import { addDays, formatDate, parseLocal, toDateKey } from "../../dateUtils";
import { TaskModal } from "../../modals/TaskModal";
import { confirmAction } from "../../modals/ConfirmModal";
import { noteName, openLinkedNote, openTaskEvent, taskTimeLabel, toggleDone } from "./helpers";
import { openOccurrence } from "../shared";
import { openTask } from "./openTask";
import { entryCount } from "./progressLog";
import { TaskDetailsModal } from "../../modals/TaskDetailsModal";

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
		void toggleDone(plugin, t);
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
	if (t.event) {
		const gone = store.eventGone(t);
		const m = meta.createSpan({ cls: "ch-task-meta-event", attr: { "aria-label": gone ? "Event deleted" : "Open event", title: gone ? `${t.event.title} (deleted)` : t.event.title } });
		m.toggleClass("is-gone", gone);
		setIcon(m.createSpan({ cls: "ch-task-meta-icon" }), "calendar");
		// "Track as task": the task is the event itself, so its name is the task's title already.
		m.appendText(t.event.self ? "Event" : t.event.title || "Event");
		m.onclick = (e) => {
			e.stopPropagation();
			void openTaskEvent(plugin, t, (occ) => openOccurrence(plugin, occ));
		};
	}
	// A tracked event: the progress of the event's own tasks, as on the event in the calendar.
	if (t.event?.self) {
		const evTasks = store.forEvent(t.event.key);
		if (evTasks.length) {
			const d = evTasks.filter((x) => x.done).length;
			const h = meta.createSpan({ cls: "ch-task-hint ch-task-meta-evtasks", attr: { "aria-label": `${d} of ${evTasks.length} event tasks done` } });
			h.toggleClass("is-complete", d === evTasks.length);
			setIcon(h.createSpan({ cls: "ch-task-hint-icon" }), d === evTasks.length ? "check-square" : "square");
			h.appendText(`${d}/${evTasks.length}`);
		}
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
	// Progress log: "📝 3" (the entries themselves are in the details view).
	if (plugin.settings.tasksProgressLog && t.log?.length) meta.createSpan({ cls: "ch-task-has-log", text: `📝 ${t.log.length}`, attr: { "aria-label": `Progress log: ${entryCount(t.log.length)}` } });
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

	// A tracked event is edited as an event (its title, day and time come from there).
	row.onclick = () => openTask(plugin, t);
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
	if (t.event?.self) {
		// "Track as task": day, time and title belong to the event; the rest is done there.
		menu.addItem((i) => i.setTitle(t.done ? "Mark as not done" : "Mark as done").setIcon("check").onClick(() => void toggleDone(plugin, t)));
		menu.addItem((i) => i.setTitle("Open event").setIcon("calendar").onClick(() => void openTaskEvent(plugin, t, (occ) => openOccurrence(plugin, occ))));
		// (Everything here is also reachable by tapping: the tick circle, and the event dialog's "Track as task" switch.)
		menu.addSeparator();
		menu.addItem((i) => i.setTitle("Stop tracking as task").setIcon("list-x").onClick(() => void store.remove(t.id)));
		menu.showAtMouseEvent(e);
		return;
	}
	const when = (title: string, icon: string, date: string | undefined) =>
		menu.addItem((i) => i.setTitle(title).setIcon(icon).onClick(() => void store.update(t.id, { date })));
	menu.addItem((i) => i.setTitle(t.done ? "Mark as not done" : "Mark as done").setIcon("check").onClick(() => void store.setDone(t.id, !t.done)));
	menu.addItem((i) => i.setTitle("Show details").setIcon("info").onClick(() => new TaskDetailsModal(plugin, t).open()));
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
