import { setIcon } from "obsidian";
import type OmniCalendarPlugin from "../../main";
import { Task } from "../../types";
import { addMinutes, MS_HOUR, parseLocal, timeKeyToMinutes } from "../../dateUtils";
import { DayTasksModal } from "../../modals/DayTasksModal";
import { TaskModal } from "../../modals/TaskModal";
import { taskMenu } from "../tasks/taskRow";
import { taskTimeLabel } from "../tasks/helpers";
import { CalendarHost } from "./host";
import { HOUR_HEIGHT } from "./layout";

/** Drag & drop type for tasks (events use DRAG_MIME). */
export const TASK_MIME = "application/x-omni-calendar-task";

/** A task with a time, placed in the week / day grid. A single time ("10:30") is drawn half an hour long. */
export interface TaskSlot {
	task: Task;
	start: Date;
	end: Date;
}

const SINGLE_TIME_MIN = 30;

/** The day's tasks that have a time, as slots for the time grid. */
export function timedTaskSlots(plugin: OmniCalendarPlugin, date: string): TaskSlot[] {
	return plugin.tasks.forCalendarDay(date).filter((t) => t.start).map((task) => {
		const day = parseLocal(date);
		const start = addMinutes(day, timeKeyToMinutes(task.start as string));
		const end = task.end ? addMinutes(day, timeKeyToMinutes(task.end)) : addMinutes(start, SINGLE_TIME_MIN);
		return { task, start, end };
	});
}

/**
 * One counter per day ("☐ 3"): the day's open tasks. `timed` = false counts only tasks without a time
 * (week / day view, where timed tasks have their own blocks). Tap it to list, tick off and add tasks.
 * Nothing is drawn when the day has no tasks.
 */
export function dayTaskCounter(plugin: OmniCalendarPlugin, parent: HTMLElement, date: string, timed: boolean): HTMLElement | null {
	const tasks = plugin.tasks.forCalendarDay(date).filter((t) => timed || !t.start);
	if (!tasks.length) return null;
	const open = tasks.filter((t) => !t.done).length;
	const btn = parent.createEl("button", { cls: "ch-day-tasks", attr: { "data-date": date } });
	btn.toggleClass("is-done", open === 0);
	setIcon(btn.createSpan({ cls: "ch-day-tasks-icon" }), open === 0 ? "check-square" : "square");
	btn.createSpan({ cls: "ch-day-tasks-count", text: String(open || tasks.length) });
	btn.setAttr("aria-label", open ? `${open} open ${open === 1 ? "task" : "tasks"}` : "All tasks done");
	btn.addEventListener("pointerdown", (e) => e.stopPropagation());
	btn.addEventListener("dblclick", (e) => e.stopPropagation());
	btn.onclick = (e) => {
		e.stopPropagation();
		new DayTasksModal(plugin, date).open();
	};
	return btn;
}

/** A timed task in a day column of the week / day grid: a light block with a checkbox. */
export function taskBlock(
	host: CalendarHost, col: HTMLElement, slot: TaskSlot,
	at: { colIdx: number; colCount: number }
) {
	const { plugin } = host;
	const t = slot.task;
	const startMin = slot.start.getHours() * 60 + slot.start.getMinutes();
	const top = (startMin / 60) * HOUR_HEIGHT;
	const height = Math.max(((slot.end.getTime() - slot.start.getTime()) / MS_HOUR) * HOUR_HEIGHT, 18);
	const el = col.createDiv({ cls: "ch-tg-task", attr: { "data-task": t.id } });
	el.style.setProperty("--ch-event-color", plugin.tasks.list(t.listId).color);
	el.style.top = `${top}px`;
	el.style.height = `${height - 2}px`;
	el.style.left = `calc(${(at.colIdx / at.colCount) * 100}% + 1px)`;
	el.style.width = `calc(${(1 / at.colCount) * 100}% - 3px)`;
	el.toggleClass("is-done", t.done);
	if (height < 36) el.addClass("ch-compact");
	const line = el.createDiv({ cls: "ch-tg-task-line" });
	const check = line.createEl("button", { cls: "ch-task-checkbox ch-small", attr: { role: "checkbox", "aria-checked": String(t.done), "aria-label": t.done ? "Mark as not done" : "Mark as done" } });
	if (t.done) setIcon(check, "check");
	check.onclick = (e) => {
		e.stopPropagation();
		void plugin.tasks.setDone(t.id, !t.done);
	};
	line.createSpan({ cls: "ch-tg-task-title", text: t.title });
	el.createDiv({ cls: "ch-tg-task-time", text: taskTimeLabel(t) });
	el.setAttr("title", `${t.title}\n${taskTimeLabel(t)}\nTask · ${plugin.tasks.list(t.listId).name}`);
	el.addEventListener("pointerdown", (e) => e.stopPropagation());
	el.addEventListener("click", (e) => {
		e.stopPropagation();
		new TaskModal(plugin, t).open();
	});
	el.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
		taskMenu(plugin, t, e);
	});
	host.drag.grabbableTask(el, t, slot);
}
