import { EventRef, Modal, Setting, setIcon } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { Task } from "../types";
import { dayTitle, PRIORITY_NAMES } from "../tasks";
import { formatDate, parseLocal } from "../dateUtils";
import { keepFocusOnTap } from "../pickers";
import { EventModal } from "./EventModal";
import { TaskModal } from "./TaskModal";
import { linkedNotesBlock } from "../views/linkedNotes";
import { notesBlock } from "../views/notesBlock";
import { noteChips, openTaskEvent, taskTimeLabel, toggleDone } from "../views/tasks/helpers";
import { subtaskNoteMenu } from "../views/tasks/subtaskNotes";
import { openOccurrence } from "../views/shared";
import { LogDraft, progressLogBlock } from "../views/tasks/progressLog";

/**
 * The details view of a task (1.9): everything at a glance, nothing changed by accident. Quick actions stay possible:
 * tick the task or its subtasks off, "Edit notes", open (and link) notes, open its event. "Edit" opens the task dialog.
 */
export class TaskDetailsModal extends Modal {
	private ref: EventRef | null = null;
	/** The notes are being edited: don't redraw (that would throw away what is typed). */
	private editing = false;
	/** Text typed into the progress log's "add" field, kept across redraws. */
	private logDraft: LogDraft = { text: "" };

	constructor(private plugin: OmniCalendarPlugin, private task: Task) {
		super(plugin.app);
	}

	onOpen() {
		EventModal.openCount++;
		this.modalEl.addClass("ch-details-modal", "ch-task-details");
		keepFocusOnTap(this.modalEl);
		this.ref = this.plugin.tasks.on("changed", () => {
			if (!this.editing) this.refresh();
		});
		this.render();
	}

	/** Look the task up again; close when it was deleted. */
	private refresh() {
		const now = this.plugin.tasks.get(this.task.id);
		if (!now) {
			this.close();
			return;
		}
		this.task = now;
		this.render();
	}

	private render() {
		const { contentEl, task: t, plugin } = this;
		const store = plugin.tasks;
		// Keep typing in the progress log's field when something else redraws the view.
		const typing = !!document.activeElement?.classList.contains("ch-log-input") && contentEl.contains(document.activeElement);
		contentEl.empty();
		this.setTitle("Task");

		// Title with its tick circle.
		const head = contentEl.createDiv({ cls: "ch-task-details-title" });
		head.toggleClass("is-done", t.done);
		head.style.setProperty("--ch-event-color", store.list(t.listId).color);
		const check = head.createEl("button", { cls: "ch-task-checkbox", attr: { role: "checkbox", "aria-checked": String(t.done), "aria-label": t.done ? "Mark as not done" : "Mark as done" } });
		if (t.done) setIcon(check, "check");
		check.onclick = () => void toggleDone(plugin, t);
		head.createSpan({ cls: "ch-task-details-name", text: t.title });

		const meta = contentEl.createDiv({ cls: "ch-details" });
		const when = t.date
			? `${dayTitle(t.date)}${["Today", "Tomorrow", "Yesterday"].includes(dayTitle(t.date)) ? ` · ${formatDate(parseLocal(t.date), { weekday: "short", day: "numeric", month: "short" })}` : ""}${t.start ? ` · ${taskTimeLabel(t)}` : ""}`
			: "No date";
		meta.createDiv({ cls: "ch-details-row", text: `🕒 ${when}` });
		const list = meta.createDiv({ cls: "ch-details-row" });
		list.createSpan({ cls: "ch-dot" }).style.backgroundColor = store.list(t.listId).color;
		list.createSpan({ text: store.list(t.listId).name });
		if (t.priority > 0) meta.createDiv({ cls: `ch-details-row ch-task-prio ch-prio-${t.priority}`, text: `${"!".repeat(t.priority)} ${PRIORITY_NAMES[t.priority]} priority` });
		if (t.event) {
			const ev = meta.createDiv({ cls: "ch-details-row" });
			ev.appendText("📅 ");
			const a = ev.createEl("a", { cls: "ch-task-event-name", text: t.event.title || "Event" });
			a.toggleClass("is-gone", store.eventGone(t));
			a.onclick = (e) => {
				e.preventDefault();
				void openTaskEvent(plugin, t, (occ) => {
					this.close();
					openOccurrence(plugin, occ);
				});
			};
		}

		notesBlock(contentEl, {
			label: "Notes",
			text: t.notes ?? "",
			empty: "No notes",
			save: (text) => store.update(t.id, { notes: text || undefined }),
			onEditing: (on) => {
				this.editing = on;
				if (!on) window.setTimeout(() => this.refresh(), 0);
			},
		});

		// Subtasks, tickable here.
		if (t.subtasks.length) {
			const sh = contentEl.createDiv({ cls: "ch-task-section-head" });
			sh.createSpan({ text: "Subtasks" });
			sh.createSpan({ cls: "ch-event-tasks-progress", text: `${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length}` });
			const subs = contentEl.createDiv({ cls: "ch-event-subtasks ch-details-subtasks" });
			subs.style.setProperty("--ch-event-color", store.list(t.listId).color);
			for (const st of t.subtasks) {
				const row = subs.createDiv({ cls: "ch-event-subtask" });
				row.toggleClass("is-done", st.done);
				const cb = row.createEl("button", { cls: "ch-task-checkbox ch-small", attr: { role: "checkbox", "aria-checked": String(st.done), "aria-label": st.done ? "Mark as not done" : "Mark as done" } });
				if (st.done) setIcon(cb, "check");
				cb.onclick = () => void store.setSubtaskDone(t.id, st.id, !st.done);
				const body = row.createDiv({ cls: "ch-details-subtask-body" });
				body.createSpan({ cls: "ch-event-subtask-title", text: st.title });
				if (!plugin.settings.tasksNoteExtras) continue;
				// Short description in small grey text; linked notes as chips (1.9.3).
				if (st.description) body.createDiv({ cls: "ch-details-subtask-desc", text: st.description });
				noteChips(plugin, body, st.links, "ch-details-subtask-notes");
				const more = row.createEl("button", { cls: "ch-log-action ch-subtask-more", attr: { "aria-label": "Notes of this subtask" } });
				setIcon(more, "more-horizontal");
				more.onclick = (e) => subtaskNoteMenu(plugin, t, st, e);
			}
		}

		if (plugin.settings.tasksProgressLog) {
			progressLogBlock(plugin, contentEl, t, {
				draft: this.logDraft,
				onEditing: (on) => {
					this.editing = on;
					if (!on) window.setTimeout(() => this.refresh(), 0);
				},
			});
			if (typing) contentEl.querySelector<HTMLTextAreaElement>(".ch-log-input")?.focus();
		}

		linkedNotesBlock(plugin, contentEl.createDiv({ cls: "ch-event-notes" }), {
			get: () => t.links,
			set: (links) => store.update(t.id, { links }),
			// "Create note" (1.9.3); a tracked event has the event's own note instead.
			extra: t.event?.self || !plugin.settings.tasksNoteExtras ? undefined : {
				label: plugin.hasTaskNote(t) ? "Open note" : "Create note", icon: "file-plus", cls: "ch-create-note-btn",
				run: () => void plugin.createNoteForTask(t),
			},
		});

		const buttons = new Setting(contentEl).setClass("ch-modal-buttons");
		buttons.addButton((b) => b.setButtonText("Close").onClick(() => this.close()));
		buttons.addButton((b) =>
			b.setButtonText("Edit").setCta().onClick(() => {
				this.close();
				new TaskModal(plugin, t).open();
			})
		);
	}

	onClose() {
		EventModal.openCount = Math.max(0, EventModal.openCount - 1);
		if (this.ref) this.plugin.tasks.offref(this.ref);
		this.contentEl.empty();
	}
}
