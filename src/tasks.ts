import { Events } from "obsidian";
import type OmniCalendarPlugin from "./main";
import { OmniCalendarSettings, SmartListId, Subtask, Task, TaskData, TaskEventLink, TaskList, TaskLogEntry, TaskPriority } from "./types";
import type { EventNow } from "./store";
import { addDays, dateLang, dayDiff, MS_DAY, parseLocal, startOfDay, timeKeyToMinutes, toDateKey, uid } from "./dateUtils";

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

/** Tasks on events are shown (the event's Tasks section, "Add task…", "2/5"): Tasks on, and "Tasks on events" on. */
export function eventTasksOn(s: OmniCalendarSettings): boolean {
	return s.tasksEnabled && s.tasksOnEvents;
}

/** The automatic lists to show, in order: all in the usual order, or (when customizing) the user's order without hidden ones. */
export function visibleSmartLists(s: OmniCalendarSettings): typeof SMART_LISTS {
	if (!s.tasksCustomLists) return SMART_LISTS;
	return s.tasksListOrder
		.filter((id) => !s.tasksHiddenLists.includes(id))
		.map((id) => SMART_LISTS.find((l) => l.id === id))
		.filter((l): l is (typeof SMART_LISTS)[number] => !!l);
}

/** Subtask descriptions and notes are shown: their own switch, and the main "Create note for tasks" switch. */
export function subtaskExtrasOn(s: OmniCalendarSettings): boolean {
	return s.tasksNoteExtras && s.tasksSubtaskExtras;
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
			subtasks: (Array.isArray(t.subtasks) ? t.subtasks : []).filter((s) => s && typeof s.id === "string").map((s) => ({
				id: s.id, title: String(s.title ?? ""), done: !!s.done,
				...(typeof s.description === "string" && s.description.trim() ? { description: s.description.trim() } : {}),
				links: stringList(s.links),
			})),
			done: !!t.done,
			// A done task without a completion time counts from now (so a clean-up can't delete it at once).
			completedAt: typeof t.completedAt === "number" ? t.completedAt : t.done ? Date.now() : undefined,
			createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
			links: stringList(t.links),
			event: normalizeEventLink(t.event),
			log: normalizeLog(t.log),
		}));
	for (const t of items) {
		if (!t.date) t.start = undefined;
		if (!t.start) t.end = undefined;
	}
	return { lists, items };
}

/** A task's event link, or undefined when it is incomplete. */
/** Note paths: strings only. */
function stringList(raw: unknown): string[] {
	return (Array.isArray(raw) ? raw : []).filter((p): p is string => typeof p === "string");
}

/** Progress log entries: valid ones only, oldest first; undefined when there are none. */
function normalizeLog(raw: unknown): TaskLogEntry[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const log: TaskLogEntry[] = raw
		.filter((e) => e && typeof e.at === "number" && Number.isFinite(e.at) && typeof e.text === "string" && e.text.trim())
		.map((e) => ({
			id: typeof e.id === "string" && e.id ? e.id : uid(),
			at: e.at,
			text: e.text,
			...(typeof e.editedAt === "number" && Number.isFinite(e.editedAt) ? { editedAt: e.editedAt } : {}),
		}))
		.sort((a, b) => a.at - b.at);
	return log.length ? log : undefined;
}

function normalizeEventLink(raw: unknown): TaskEventLink | undefined {
	const e = raw as Partial<TaskEventLink> | undefined;
	if (!e || typeof e.key !== "string" || !e.key || !/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? "")) return undefined;
	return { key: e.key, title: String(e.title ?? ""), date: e.date as string, ...(e.self ? { self: true } : {}) };
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

	/** The tasks that belong to an event occurrence (by `eventKey()`), in list order – not its "Track as task" entry. */
	forEvent(key: string): Task[] {
		return this.eventTasks(key).filter((t) => !t.event?.self);
	}

	/** The event's "Track as task" entry, if it is tracked. */
	tracked(key: string): Task | undefined {
		return this.eventTasks(key).find((t) => t.event?.self);
	}

	/** Turn "Track as task" on or off for an event (`now`: its title / day / time, see `eventNowOf`). */
	async setTracked(key: string, now: EventNow, on: boolean) {
		const existing = this.tracked(key);
		if (!on) {
			if (existing) await this.remove(existing.id);
			return;
		}
		if (existing) return;
		await this.upsert(this.draft({
			title: now.title, date: now.day, start: now.start, end: now.end,
			event: { key, title: now.title, date: now.day, self: true },
		}));
	}

	private eventTasks(key: string): Task[] {
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

	/**
	 * An event moved to another day (edited, dragged, changed in Google / Outlook or on another device):
	 * its tasks move by the same number of days, so a task on the event's day stays on it, and one
	 * "two days before" stays two days before. Times are kept. Runs after every calendar change.
	 */
	async followEvents(): Promise<number> {
		let moved = 0;
		for (const t of this.items) {
			if (!t.event) continue;
			const now = this.plugin.store.eventNow(t.event.key);
			if (!now) continue;
			// "Track as task": the task mirrors the event (title, day, time).
			if (t.event.self) {
				if (t.title === now.title && t.date === now.day && t.start === now.start && t.end === now.end && t.event.date === now.day) continue;
				Object.assign(t, { title: now.title, date: now.day, start: now.start, end: now.end });
				t.event = { ...t.event, title: now.title, date: now.day };
				moved++;
				continue;
			}
			if (now.day === t.event.date && now.title === t.event.title) continue;
			if (now.day !== t.event.date && t.date) {
				const shift = dayDiff(parseLocal(t.event.date), parseLocal(now.day));
				t.date = toDateKey(addDays(parseLocal(t.date), shift));
			}
			t.event = { ...t.event, title: now.title, date: now.day };
			moved++;
		}
		if (moved) await this.save();
		return moved;
	}

	/** Keep the event's title and day in its tasks up to date (shown in task lists). */
	async refreshEventInfo(key: string, title: string, date: string) {
		// Events that can move are kept up to date by `followEvents` (which also moves the tasks).
		if (this.plugin.store.eventNow(key)) return this.followEvents();
		const stale = this.items.filter((t) => t.event?.key === key && (t.event.title !== title || t.event.date !== date));
		if (!stale.length) return;
		for (const t of stale) t.event = { key, title, date };
		await this.save();
	}

	/**
	 * Tasks shown in the calendar on one day (YYYY-MM-DD): the day's tasks, except completed ones when
	 * the setting hides them. Tasks of an event are left out unless they have a time: the event shows them ("2/5") –
	 * except when "Tasks on events" is off: then they count like any other task.
	 */
	forCalendarDay(date: string): Task[] {
		const s = this.plugin.settings;
		if (!s.tasksEnabled || !s.tasksInCalendar) return [];
		return this.items
			// The event of a "Track as task" entry is already in the calendar (with a tick circle).
			.filter((t) => t.date === date && (s.tasksCalendarShowDone || !t.done) && (!t.event || (!t.event.self && (!!t.start || !s.tasksOnEvents))))
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
		for (const sub of task.subtasks) sub.links ??= [];
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

	/** Tick several tasks off (or on) at once, saved once. */
	async setDoneMany(ids: string[], done: boolean) {
		const now = Date.now();
		for (const t of this.items) {
			if (!ids.includes(t.id) || t.done === done) continue;
			t.done = done;
			t.completedAt = done ? now : undefined;
		}
		await this.save();
	}

	async setSubtaskDone(taskId: string, subId: string, done: boolean) {
		const s = this.get(taskId)?.subtasks.find((x) => x.id === subId);
		if (!s) return;
		s.done = done;
		await this.save();
	}

	/** Progress log: add an entry (now) at the bottom. */
	async addLog(taskId: string, text: string) {
		const t = this.get(taskId);
		if (!t || !text.trim()) return;
		(t.log ??= []).push({ id: uid(), at: Date.now(), text: text.trim() });
		await this.save();
	}

	/** Change an entry's text; its original time stays. */
	async editLog(taskId: string, entryId: string, text: string) {
		const e = this.get(taskId)?.log?.find((x) => x.id === entryId);
		if (!e || !text.trim() || text.trim() === e.text) return;
		e.text = text.trim();
		e.editedAt = Date.now();
		await this.save();
	}

	async removeLog(taskId: string, entryId: string) {
		const t = this.get(taskId);
		if (!t?.log) return;
		t.log = t.log.filter((x) => x.id !== entryId);
		if (!t.log.length) t.log = undefined;
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

	/** Everything that has linked notes: tasks and their subtasks. */
	private *linkOwners(): Generator<{ links: string[] }> {
		for (const t of this.items) {
			yield t;
			yield* t.subtasks;
		}
	}

	/** Link a note to a task, or to one of its subtasks (no duplicates). */
	async addLink(taskId: string, path: string, subId?: string) {
		const t = this.get(taskId);
		const owner = subId ? t?.subtasks.find((x) => x.id === subId) : t;
		if (!owner || owner.links.includes(path)) return;
		owner.links.push(path);
		await this.save();
	}

	/** Replace the linked notes of a subtask. */
	async setSubtaskLinks(taskId: string, subId: string, links: string[]) {
		const s = this.get(taskId)?.subtasks.find((x) => x.id === subId);
		if (!s) return;
		s.links = links;
		await this.save();
	}

	/** A note was renamed / moved: keep the links (of tasks and subtasks). Returns true if something changed. */
	renameLink(oldPath: string, newPath: string): boolean {
		let changed = false;
		for (const owner of this.linkOwners()) {
			const i = owner.links.indexOf(oldPath);
			if (i >= 0) {
				owner.links[i] = newPath;
				changed = true;
			}
		}
		if (changed) {
			this.version++;
			this.trigger("changed");
		}
		return changed;
	}

	/** A note was deleted: drop its links (of tasks and subtasks). */
	removeLink(path: string): boolean {
		let changed = false;
		for (const owner of this.linkOwners()) {
			if (owner.links.includes(path)) {
				owner.links = owner.links.filter((p) => p !== path);
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
	return d.toLocaleDateString(dateLang(), { weekday: "long", day: "numeric", month: "long" });
}

/** Subtask helper for the dialog. */
export function newSubtask(title: string): Subtask {
	return { id: uid(), title, done: false, links: [] };
}
