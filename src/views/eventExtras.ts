import { Setting, setIcon } from "obsidian";
import { eventNowOf } from "../store";
import type OmniCalendarPlugin from "../main";
import { CalendarOccurrence, Task } from "../types";
import { formatDate, parseLocal, toDateKey } from "../dateUtils";
import { eventKey } from "../eventLinks";
import { openTask } from "./tasks/openTask";
import { linkedNotesBlock } from "./linkedNotes";
import { taskMenu } from "./tasks/taskRow";
import { taskTimeLabel } from "./tasks/helpers";

/**
 * The parts of the event dialog / details view that live only in Obsidian, also for Google / Outlook and
 * ICS events: the event's **tasks** (tick off, add, open) and its **linked notes** (incl. "Create note").
 * Returns a function that stops listening for changes (call it when the dialog closes).
 */
export function eventExtras(
	plugin: OmniCalendarPlugin,
	container: HTMLElement,
	occ: CalendarOccurrence,
	opts: { beforeCreateNote?: () => Promise<CalendarOccurrence | undefined>; afterCreateNote?: () => void } = {}
): () => void {
	const key = eventKey(occ);
	const day = toDateKey(occ.start);
	const stops: (() => void)[] = [];

	if (plugin.settings.tasksEnabled) {
		void plugin.tasks.refreshEventInfo(key, occ.title, day);
		// "Track as task": the event itself in the task lists, to tick it off (repeating events: with 1.9).
		if (!occ.recurring) {
			new Setting(container)
				.setName("Track as task")
				.setDesc("Show this event in your task lists, to tick it off when it's done.")
				.setClass("ch-track-setting")
				.addToggle((t) =>
					t.setValue(!!plugin.tasks.tracked(key)).onChange((v) => void plugin.tasks.setTracked(key, eventNowOf(occ.title, occ.start, occ.end, occ.allDay), v))
				);
		}
		const wrap = container.createDiv({ cls: "ch-event-tasks" });
		const head = wrap.createDiv({ cls: "ch-task-section-head" });
		head.createSpan({ text: "Tasks" });
		const progress = head.createSpan({ cls: "ch-event-tasks-progress" });
		const list = wrap.createDiv({ cls: "ch-event-task-list" });
		// Subtasks are shown under their task (folded away with a click on "1/3"), like on the Tasks page.
		const folded = new Set<string>();
		const add = wrap.createEl("input", { type: "text", cls: "ch-input ch-event-task-add", attr: { placeholder: "+ Add a task (Enter)" } });
		add.addEventListener("keydown", (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			const title = add.value.trim();
			if (!title) return;
			add.value = "";
			void plugin.tasks.upsert(plugin.tasks.draft({ title, date: day, event: { key, title: occ.title, date: day } }));
		});
		const render = () => {
			list.empty();
			const tasks = plugin.tasks.forEvent(key);
			const done = tasks.filter((t) => t.done).length;
			progress.setText(tasks.length ? `${done}/${tasks.length}` : "");
			for (const t of tasks) {
				eventTaskRow(plugin, list, t, day, {
					folded: folded.has(t.id),
					toggle: () => {
						if (!folded.delete(t.id)) folded.add(t.id);
						render();
					},
				});
			}
		};
		render();
		const ref = plugin.tasks.on("changed", render);
		stops.push(() => plugin.tasks.offref(ref));
	}

	const notes = container.createDiv({ cls: "ch-event-notes" });
	let block: { render: () => void } | null = null;
	const createLabel = () => (plugin.hasEventNote(occ) ? "Open note" : "Create note");
	block = linkedNotesBlock(plugin, notes, {
		get: () => plugin.store.linksFor(occ),
		set: (links) => plugin.store.setLinks(occ, links),
		extra: {
			label: createLabel(), icon: "file-plus", cls: "ch-create-note-btn",
			run: async () => {
				const target = (await opts.beforeCreateNote?.()) ?? occ;
				await plugin.createNoteForEvent(target);
				block?.render();
				opts.afterCreateNote?.();
			},
		},
	});
	return () => stops.forEach((f) => f());
}

/** One task in the event's task list: checkbox, title, time (and date when it's not the event's day). */
function eventTaskRow(
	plugin: OmniCalendarPlugin, parent: HTMLElement, t: Task, eventDay: string,
	subs: { folded: boolean; toggle: () => void }
) {
	const row = parent.createDiv({ cls: "ch-event-task", attr: { "data-task": t.id } });
	row.toggleClass("is-done", t.done);
	const check = row.createEl("button", { cls: "ch-task-checkbox ch-small", attr: { role: "checkbox", "aria-checked": String(t.done), "aria-label": t.done ? "Mark as not done" : "Mark as done" } });
	if (t.done) setIcon(check, "check");
	check.onclick = (e) => {
		e.stopPropagation();
		void plugin.tasks.setDone(t.id, !t.done);
	};
	row.createSpan({ cls: "ch-event-task-title", text: t.title });
	const when = [t.date && t.date !== eventDay ? formatDate(parseLocal(t.date), { day: "numeric", month: "short" }) : "", taskTimeLabel(t)].filter(Boolean).join(" ");
	if (when) row.createSpan({ cls: "ch-event-task-when", text: when });
	if (t.subtasks.length) {
		const doneN = t.subtasks.filter((x) => x.done).length;
		const count = row.createSpan({ cls: "ch-event-task-subcount", attr: { "aria-label": "Show or hide subtasks" } });
		setIcon(count.createSpan({ cls: "ch-task-meta-icon" }), subs.folded ? "chevron-right" : "chevron-down");
		count.appendText(`${doneN}/${t.subtasks.length}`);
		count.onclick = (e) => {
			e.stopPropagation();
			subs.toggle();
		};
	}
	if (t.priority > 0) row.createSpan({ cls: `ch-task-prio ch-prio-${t.priority}`, text: "!".repeat(t.priority) });
	row.onclick = () => openTask(plugin, t);
	row.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		taskMenu(plugin, t, e);
	});
	if (!t.subtasks.length || subs.folded) return;
	// The subtasks, tickable right here.
	const list = parent.createDiv({ cls: "ch-event-subtasks" });
	for (const st of t.subtasks) {
		const sr = list.createDiv({ cls: "ch-event-subtask" });
		sr.toggleClass("is-done", st.done);
		const cb = sr.createEl("button", { cls: "ch-task-checkbox ch-small", attr: { role: "checkbox", "aria-checked": String(st.done), "aria-label": st.done ? "Mark as not done" : "Mark as done" } });
		if (st.done) setIcon(cb, "check");
		cb.onclick = (e) => {
			e.stopPropagation();
			void plugin.tasks.setSubtaskDone(t.id, st.id, !st.done);
		};
		sr.createSpan({ cls: "ch-event-subtask-title", text: st.title });
	}
}
