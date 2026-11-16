import { Events } from "obsidian";
import type OmniCalendarPlugin from "./main";
import { SmartListId, Subtask, Task, TaskData, TaskEventLink, TaskList, TaskPriority } from "./types";
import { addDays, MS_DAY, parseLocal, startOfDay, timeKeyToMinutes, toDateKey, uid } from "./dateUtils";

export const DEFAULT_TASK_LIST: TaskList = { id: "tasks", name: "Tasks", color: "#7c5cff" };

export const SMART_LISTS: { id: SmartListId; name: string; icon: string }[] = [
	{ id: "today", name: "Today", icon: "sun" },
	{ id: "tomorrow", name: "Tomorrow", icon: "sunrise" },
	{ id: "upcoming", name: "Upcoming", icon: "calendar-range" },
	{ id: "overdue", name: "Overdue", icon: "alarm-clock" },
	{ id: "nodate", name: "No date", icon: "inbox" },
	{ id: "all", name: "All", icon: "list" },
	{ id: "done", name: "Done", icon: "check-circle-2" },
];

export const PRIORITY_NAMES: Record<TaskPriority, string> = { 0: "None", 1: "Low", 2: "Medium", 3: "High" };

export interface TaskGroup {
	key: string;
	title: string;
	tasks: Task[];
	/** Shown collapsed (the Done section). */
	collapsed?: boolean;
	overdue?: boolean;
}

/** Bring stored task data into a valid shape (missing fields, removed lists, …). */
export function normalizeTaskData(raw: unknown): TaskData {
	const r = (raw ?? {}) as Partial<TaskData>;
	const lists: TaskList[] = Array.isArray(r.lists)
		? r.lists.filter((l) => l && typeof l.id === "string").map((l) => ({ id: l.id, name: String(l.name ?? "List"), color: String(l.color ?? DEFAULT_TASK_LIST.color) }))
		: [];
	if (!lists.some((l) => l.id === DEFAULT_TASK_LIST.id)) lists.unshift({ ...DEFAULT_TASK_LIST });
	const items: Task[] = (Array.isArray(r.items) ? r.items : [])
		.filter((t) => t && typeof t.id === "string")
		.map((t) => ({
			id: t.id,
			title: String(t.title ?? ""),
			notes: t.notes ? String(t.notes) : undefined,
			listId: lists.some((l) => l.id === t.listId) ? t.listId : DEFAULT_TASK_LIST.id,
			priority: ([0, 1, 2, 3].includes(Number(t.priority)) ? Number(t.priority) : 0) as TaskPriority,
			date: /^\d{4}-\d{2}-\d{2}$/.test(t.date ?? "") ? t.date : undefined,
			start: /^\d{2}:\d{2}$/.test(t.start ?? "") ? t.start : undefined,
			end: /^\d{2}:\d{2}$/.test(t.end ?? "") ? t.end : undefined,
			subtasks: (Array.isArray(t.subtasks) ? t.subtasks : []).filter((s) => s && typeof s.id === "string").map((s) => ({ id: s.id, title: String(s.title ?? ""), done: !!s.done })),
			done: !!t.done,
			// A done task without a completion time counts from now (so a clean-up can't delete it at once).
			completedAt: typeof t.completedAt === "number" ? t.completedAt : t.done ? Date.now() : undefined,
			createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
			links: (Array.isArray(t.links) ? t.links : []).filter((p) => typeof p === "string"),
			event: normalizeEventLink(t.event),
		}));
	for (const t of items) {
		if (!t.date) t.start = undefined;
		if (!t.start) t.end = undefined;
	}
	return { lists, items };
}

/** A task's event link, or undefined when it is incomplete. */
function normalizeEventLink(raw: unknown): TaskEventLink | undefined {
	const e = raw as Partial<TaskEventLink> | undefined;
	if (!e || typeof e.key !== "string" || !e.key || !/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? "")) return undefined;
	return { key: e.key, title: String(e.title ?? ""), date: e.date as string };
}

/** Minutes since midnight; tasks without a time sort after all timed ones. */
function minutes(hhmm?: string): number {
	return hhmm ? timeKeyToMinutes(hhmm) : 24 * 60 + 1;
}

/** Priority (high first), then date, then time (timed before untimed), then creation order. */
export function compareTasks(a: Task, b: Task): number {
	return (
		b.priority - a.priority ||
		(a.date ?? "9999").localeCompare(b.date ?? "9999") ||
		minutes(a.start) - minutes(b.start) ||
		a.createdAt - b.createdAt
	);
}

/** Tasks data + operations. Emits "changed" after every modification. */
export class TaskStore extends Events {
	constructor(private plugin: OmniCalendarPlugin) {
		super();
	}

	/** Days after today covered by "Upcoming" (setting, default 7). */
	get upcomingDays(): number {
		return this.plugin.settings.tasksUpcomingDays || 7;
	}

	get data(): TaskData {
		return this.plugin.data.tasks;
	}
	get lists(): TaskList[] {
		return this.data.lists;
	}
	get items(): Task[] {
		return this.data.items;
	}

	list(id: string): TaskList {
		return this.lists.find((l) => l.id === id) ?? this.lists[0] ?? DEFAULT_TASK_LIST;
	}

	get(id: string): Task | undefined {
		return this.items.find((t) => t.id === id);
	}

	/** Tasks by event key, rebuilt after changes (see `forEvent`). */
	private byEvent: { items: Task[]; version: number; map: Map<string, Task[]> } | null = null;
	private version = 0;

	private async save() {
		this.version++;
		await this.plugin.persist();
		this.trigger("changed");
	}

	/** The tasks that belong to an event occurrence (by `eventKey()`), in list order. */
	forEvent(key: string): Task[] {
		if (!this.byEvent || this.byEvent.items !== this.items || this.byEvent.version !== this.version) {
			const map = new Map<string, Task[]>();
			for (const t of this.items) {
				if (!t.event) continue;
				const list = map.get(t.event.key);
				if (list) list.push(t);
				else map.set(t.event.key, [t]);
			}
			for (const list of map.values()) list.sort((a, b) => Number(a.done) - Number(b.done) || compareTasks(a, b));
			this.byEvent = { items: this.items, version: this.version, map };
		}
		return this.byEvent.map.get(key) ?? [];
	}

	/** Tasks of the events whose key matches (see `CalendarStore.keysForDelete`). */
	forEvents(match: (key: string) => boolean): Task[] {
		return this.items.filter((t) => t.event && match(t.event.key));
	}

	/** The event was deleted: its tasks go with it. Returns how many were deleted. */
	async removeForEvents(match: (key: string) => boolean): Promise<number> {
		const before = this.items.length;
		this.data.items = this.items.filter((t) => !t.event || !match(t.event.key));
		const n = before - this.items.length;
		if (n) await this.save();
		return n;
	}

	/** The event was moved to another calendar and got a new key: its tasks move along. */
	async moveEvent(oldKey: string, newKey: string, title: string, date: string) {
		const moved = this.items.filter((t) => t.event?.key === oldKey);
		if (!moved.length) return;
		for (const t of moved) t.event = { key: newKey, title, date };
		await this.save();
	}

	/** True when the task's event is a local event that no longer exists (it was deleted). */
	eventGone(t: Task): boolean {
		const local = t.event && /^local:([^@]+)(?:@(.+))?$/.exec(t.event.key);
		if (!local) return false;
		const ev = this.plugin.store.getEvent(local[1]);
		return !ev || (!!local[2] && (!ev.recurrence || !!ev.exdates?.includes(local[2])));
	}

	/** Keep the event's title and day in its tasks up to date (shown in task lists). */
	async refreshEventInfo(key: string, title: string, date: string) {
		const stale = this.items.filter((t) => t.event?.key === key && (t.event.title !== title || t.event.date !== date));
		if (!stale.length) return;
		for (const t of stale) t.event = { key, title, date };
		await this.save();
	}

	/**
	 * Tasks shown in the calendar on one day (YYYY-MM-DD): the day's tasks, except completed ones when
	 * the setting hides them. Tasks of an event are left out unless they have a time: the event shows them ("2/5").
	 */
	forCalendarDay(date: string): Task[] {
		const s = this.plugin.settings;
		if (!s.tasksEnabled || !s.tasksInCalendar) return [];
		return this.items
			.filter((t) => t.date === date && (s.tasksCalendarShowDone || !t.done) && (!t.event || !!t.start))
			.sort((a, b) => Number(a.done) - Number(b.done) || compareTasks(a, b));
	}

	// ------------------------------------------------------------------ tasks

	/** A new task with the defaults from the settings, not yet stored. */
	draft(init: Partial<Task> = {}): Task {
		const s = this.plugin.settings;
		return {
			id: uid(),
			title: "",
			listId: this.lists.some((l) => l.id === s.tasksDefaultListId) ? s.tasksDefaultListId : DEFAULT_TASK_LIST.id,
			priority: s.tasksDefaultPriority,
			subtasks: [],
			done: false,
			createdAt: Date.now(),
			links: [],
			...init,
		};
	}

	/** Insert or replace a task. */
	async upsert(task: Task) {
		if (!task.date) task.start = undefined;
		if (!task.start) task.end = undefined;
		if (task.end && task.start && task.end <= task.start) task.end = undefined;
		const i = this.items.findIndex((t) => t.id === task.id);
		if (i >= 0) this.items[i] = task;
		else this.items.push(task);
		await this.save();
	}

	async remove(id: string) {
		this.data.items = this.items.filter((t) => t.id !== id);
		await this.save();
	}

	async setDone(id: string, done: boolean) {
		const t = this.get(id);
		if (!t) return;
		t.done = done;
		t.completedAt = done ? Date.now() : undefined;
		await this.save();
	}

	async setSubtaskDone(taskId: string, subId: string, done: boolean) {
		const s = this.get(taskId)?.subtasks.find((x) => x.id === subId);
		if (!s) return;
		s.done = done;
		await this.save();
	}

	async update(id: string, patch: Partial<Task>) {
		const t = this.get(id);
		if (!t) return;
		Object.assign(t, patch);
		if (!t.date) t.start = undefined;
		if (!t.start) t.end = undefined;
		await this.save();
	}

	/** Delete completed tasks finished before this time. Returns how many were deleted. */
	async removeDoneBefore(time: number): Promise<number> {
		const before = this.items.length;
		this.data.items = this.items.filter((t) => !t.done || (t.completedAt ?? Date.now()) >= time);
		const n = before - this.items.length;
		if (n) await this.save();
		return n;
	}

	/** "Clear completed": delete all completed tasks, or those of one user list. */
	async clearDone(listId?: string): Promise<number> {
		const before = this.items.length;
		this.data.items = this.items.filter((t) => !t.done || (listId !== undefined && t.listId !== listId));
		const n = before - this.items.length;
		if (n) await this.save();
		return n;
	}

	/** Split completed tasks into the recent ones (shown) and older ones (behind "Show older"). */
	splitDone(done: Task[], now = Date.now()): { recent: Task[]; older: Task[] } {
		const days = this.plugin.settings.tasksDoneVisibleDays;
		if (days < 0) return { recent: done, older: [] };
		const limit = now - days * MS_DAY;
		const recent: Task[] = [];
		const older: Task[] = [];
		for (const t of done) ((t.completedAt ?? now) >= limit ? recent : older).push(t);
		return { recent, older };
	}

	// ------------------------------------------------------------------ lists

	async addList(name: string, color: string): Promise<TaskList> {
		const l = { id: uid(), name: name.trim() || "New list", color };
		this.lists.push(l);
		await this.save();
		return l;
	}

	async updateList(id: string, patch: Partial<Omit<TaskList, "id">>) {
		const l = this.lists.find((x) => x.id === id);
		if (!l) return;
		Object.assign(l, patch);
		await this.save();
	}

	/** Delete a list; its tasks move to the default list. The default list can't be deleted. */
	async removeList(id: string) {
		if (id === DEFAULT_TASK_LIST.id) return;
		this.data.lists = this.lists.filter((l) => l.id !== id);
		for (const t of this.items) if (t.listId === id) t.listId = DEFAULT_TASK_LIST.id;
		const s = this.plugin.settings;
		if (s.tasksDefaultListId === id) s.tasksDefaultListId = DEFAULT_TASK_LIST.id;
		await this.save();
	}

	// ------------------------------------------------------------------ linked notes

	/** A note was renamed / moved: keep the links. Returns true if something changed. */
	renameLink(oldPath: string, newPath: string): boolean {
		let changed = false;
		for (const t of this.items) {
			const i = t.links.indexOf(oldPath);
			if (i >= 0) {
				t.links[i] = newPath;
				changed = true;
			}
		}
		if (changed) {
			this.version++;
			this.trigger("changed");
		}
		return changed;
	}

	/** A note was deleted: drop its links. */
	removeLink(path: string): boolean {
		let changed = false;
		for (const t of this.items) {
			if (t.links.includes(path)) {
				t.links = t.links.filter((p) => p !== path);
				changed = true;
			}
		}
		if (changed) {
			this.version++;
			this.trigger("changed");
		}
		return changed;
	}

	// ------------------------------------------------------------------ queries

	/** Open tasks of a smart list or a user list (by id). */
	tasksFor(listId: string, today = new Date()): Task[] {
		const t0 = toDateKey(startOfDay(today));
		const t1 = toDateKey(addDays(startOfDay(today), 1));
		const tN = toDateKey(addDays(startOfDay(today), this.upcomingDays));
		const open = this.items.filter((t) => !t.done);
		switch (listId as SmartListId) {
			case "today": return open.filter((t) => t.date && t.date <= t0);
			case "tomorrow": return open.filter((t) => t.date === t1);
			case "upcoming": return open.filter((t) => t.date && t.date >= t0 && t.date <= tN);
			case "overdue": return open.filter((t) => t.date && t.date < t0);
			case "nodate": return open.filter((t) => !t.date);
			case "all": return open;
			case "done": return this.items.filter((t) => t.done);
		}
		return open.filter((t) => t.listId === listId);
	}

	/** Number of open tasks in a list (for the list navigation). */
	count(listId: string, today = new Date()): number {
		return listId === "done" ? 0 : this.tasksFor(listId, today).length;
	}

	/** Done tasks belonging to a list (for its collapsed "Done" section). */
	doneFor(listId: string): Task[] {
		if (listId === "done") return [];
		const done = this.items.filter((t) => t.done);
		if (this.lists.some((l) => l.id === listId)) return done.filter((t) => t.listId === listId);
		if (listId === "all") return done;
		return [];
	}

	/**
	 * Group tasks for display: Overdue, Today, Tomorrow, each further day of the next week,
	 * Later, No date (and Done). Each group sorted by priority, then time.
	 */
	group(tasks: Task[], done: Task[], today = new Date()): TaskGroup[] {
		const base = startOfDay(today);
		const t0 = toDateKey(base);
		const tN = toDateKey(addDays(base, this.upcomingDays));
		const groups = new Map<string, TaskGroup>();
		const add = (key: string, title: string, t: Task, extra: Partial<TaskGroup> = {}) => {
			let g = groups.get(key);
			if (!g) groups.set(key, (g = { key, title, tasks: [], ...extra }));
			g.tasks.push(t);
		};
		for (const t of tasks) {
			if (!t.date) add("~nodate", "No date", t);
			else if (t.date < t0) add("!overdue", "Overdue", t, { overdue: true });
			else if (t.date > tN) add("}later", "Later", t);
			else add(t.date, dayTitle(t.date, base), t);
		}
		// Plain string order on purpose: "!overdue" < dates < "}later" < "~nodate" (localeCompare ignores the symbols).
		const out = [...groups.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
		for (const g of out) g.tasks.sort(compareTasks);
		if (done.length) {
			out.push({ key: "~~done", title: "Done", tasks: [...done].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)), collapsed: true });
		}
		return out;
	}
}

/** "Today", "Tomorrow" or e.g. "Wednesday, 18 November". */
export function dayTitle(date: string, today = startOfDay(new Date())): string {
	const d = parseLocal(date);
	const diff = Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / MS_DAY);
	if (diff === 0) return "Today";
	if (diff === 1) return "Tomorrow";
	if (diff === -1) return "Yesterday";
	return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

/** Subtask helper for the dialog. */
export function newSubtask(title: string): Subtask {
	return { id: uid(), title, done: false };
}
