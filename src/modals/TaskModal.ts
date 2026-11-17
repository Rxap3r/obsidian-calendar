import { Modal, Notice, Setting, setIcon } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { Task, TaskPriority } from "../types";
import { PRIORITY_NAMES, newSubtask } from "../tasks";
import { addDays, toDateKey } from "../dateUtils";
import { confirmAction } from "./ConfirmModal";
import { linkedNotesBlock } from "../views/linkedNotes";
import { openTaskEvent } from "../views/tasks/helpers";
import { openOccurrence } from "../views/shared";
import { DateField, TimeField, keepFocusOnTap } from "../pickers";

/** Create / edit a task: title, list, priority, date, time (range), subtasks, linked notes, notes. */
export class TaskModal extends Modal {
	private task: Task;
	private readonly isNew: boolean;
	private timeRow!: HTMLElement;
	private subtasksEl!: HTMLElement;
	private dateField!: DateField;
	/** Subtasks whose description / notes are open (the ≡ button). */
	private openSubs = new Set<string>();

	constructor(private plugin: OmniCalendarPlugin, task?: Task, init: Partial<Task> = {}) {
		super(plugin.app);
		this.isNew = !task || !plugin.tasks.get(task.id);
		// Edit a copy; nothing changes until "Save".
		this.task = task ? JSON.parse(JSON.stringify(task)) : plugin.tasks.draft(init);
	}

	onOpen() {
		const { contentEl } = this;
		const t = this.task;
		this.modalEl.addClass("ch-event-modal", "ch-task-modal");
		keepFocusOnTap(this.modalEl);
		this.setTitle(this.isNew ? "New task" : "Edit task");

		new Setting(contentEl).setName("Title").addText((txt) => {
			txt.setPlaceholder("What needs to be done?").setValue(t.title).onChange((v) => (t.title = v));
			txt.inputEl.addClass("ch-title-input");
			txt.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					void this.save();
				}
			});
			window.setTimeout(() => txt.inputEl.focus(), 10);
		});

		new Setting(contentEl).setName("List").addDropdown((d) => {
			for (const l of this.plugin.tasks.lists) d.addOption(l.id, l.name);
			d.setValue(t.listId).onChange((v) => (t.listId = v));
		});

		// The event this task belongs to (set from the event dialog or the event's menu).
		if (t.event) {
			const ev = new Setting(contentEl).setName("Event").setClass("ch-task-event-setting");
			const name = ev.controlEl.createEl("a", { cls: "ch-task-event-name", text: t.event.title || "Event" });
			if (this.plugin.tasks.eventGone(t)) {
				name.addClass("is-gone");
				ev.setDesc("This event was deleted.");
			}
			setIcon(name.createSpan({ cls: "ch-btn-icon" }), "calendar");
			name.onclick = (e) => {
				e.preventDefault();
				// An event that is gone: the choice (keep / delete) is about the saved task, so close the dialog first.
				if (!this.plugin.store.findOccurrence(t.event?.key ?? "", t.event?.date)) this.close();
				void openTaskEvent(this.plugin, t, (occ) => openOccurrence(this.plugin, occ));
			};
			ev.addExtraButton((b) =>
				b.setIcon("unlink").setTooltip("Remove from event (keep the task)").onClick(() => {
					t.event = undefined;
					ev.settingEl.remove();
				})
			);
		}

		// Priority as four buttons.
		const prio = new Setting(contentEl).setName("Priority").setClass("ch-task-prio-setting");
		const seg = prio.controlEl.createDiv({ cls: "ch-segmented ch-prio-seg" });
		const prioBtns: HTMLElement[] = [];
		([0, 1, 2, 3] as TaskPriority[]).forEach((p) => {
			const b = seg.createEl("button", { text: PRIORITY_NAMES[p], cls: `ch-prio-${p}` });
			b.toggleClass("is-active", t.priority === p);
			b.onclick = () => {
				t.priority = p;
				prioBtns.forEach((x, i) => x.toggleClass("is-active", i === p));
			};
			prioBtns.push(b);
		});

		// Date with quick buttons.
		const date = new Setting(contentEl).setName("Date").setClass("ch-task-date-setting");
		this.dateField = new DateField(date.controlEl, {
			value: t.date, placeholder: "Select date", firstDayOfWeek: this.plugin.settings.firstDayOfWeek,
			cls: "ch-task-date", allowEmpty: true, onChange: (v) => this.setDate(v),
		});
		const quick = date.controlEl.createDiv({ cls: "ch-task-quick" });
		const today = new Date();
		const q = (label: string, value: string | undefined) => {
			const b = quick.createEl("button", { text: label });
			b.onclick = () => this.setDate(value);
		};
		q("Today", toDateKey(today));
		q("Tomorrow", toDateKey(addDays(today, 1)));
		q("Next week", toDateKey(addDays(today, 7)));
		q("No date", undefined);

		// Time or time range.
		const time = new Setting(contentEl).setName("Time").setDesc("Optional. Leave “to” empty for a single time.").setClass("ch-task-time-setting");
		this.timeRow = time.settingEl;
		const use24h = this.plugin.settings.use24h;
		let to: TimeField;
		const from = new TimeField(time.controlEl, {
			value: t.start, placeholder: "Start", use24h, cls: "ch-task-start",
			onChange: (v) => {
				t.start = v;
				// No start → no end; an end before the new start is dropped.
				if (!v || (t.end && t.end <= v)) {
					t.end = undefined;
					to.setValue(undefined);
				}
			},
		});
		time.controlEl.createSpan({ cls: "ch-task-time-sep", text: "to" });
		to = new TimeField(time.controlEl, {
			value: t.end, placeholder: "End", use24h, cls: "ch-task-end",
			after: () => t.start,
			onChange: (v) => (t.end = v),
		});
		const clear = time.controlEl.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Clear time" } });
		setIcon(clear, "x");
		clear.onclick = () => {
			t.start = t.end = undefined;
			from.setValue(undefined);
			to.setValue(undefined);
		};
		this.updateTimeVisibility();

		// Subtasks.
		contentEl.createDiv({ cls: "ch-task-section-head", text: "Subtasks" });
		this.subtasksEl = contentEl.createDiv({ cls: "ch-task-subtasks" });
		this.renderSubtasks();
		const addSub = contentEl.createEl("input", { type: "text", cls: "ch-input ch-task-add-sub", attr: { placeholder: "+ Add a subtask (Enter)" } });
		addSub.addEventListener("keydown", (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			const v = addSub.value.trim();
			if (!v) return;
			t.subtasks.push(newSubtask(v));
			addSub.value = "";
			this.renderSubtasks();
		});

		// Linked notes.
		linkedNotesBlock(this.plugin, contentEl, {
			get: () => t.links,
			set: (links) => void (t.links = links),
			// "Create note" saves the task first (the note links to the saved task), then opens the note.
			extra: t.event?.self ? undefined : {
				label: this.plugin.hasTaskNote(t) ? "Open note" : "Create note", icon: "file-plus", cls: "ch-create-note-btn",
				run: () => this.createNote(),
			},
		});

		new Setting(contentEl)
			.setName("Notes")
			.setClass("ch-description-setting")
			.addTextArea((txt) => {
				txt.setPlaceholder("Optional").setValue(t.notes ?? "").onChange((v) => (t.notes = v || undefined));
				txt.inputEl.rows = 3;
			});

		const buttons = new Setting(contentEl).setClass("ch-modal-buttons");
		if (!this.isNew) buttons.addButton((b) => b.setButtonText("Delete").setWarning().onClick(() => void this.delete()));
		buttons.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
		buttons.addButton((b) => b.setButtonText(this.isNew ? "Create" : "Save").setCta().onClick(() => void this.save()));
	}

	onClose() {
		this.contentEl.empty();
	}

	private setDate(value: string | undefined) {
		this.task.date = value;
		this.dateField.setValue(value);
		this.updateTimeVisibility();
	}

	private updateTimeVisibility() {
		// A time only makes sense with a date.
		this.timeRow.toggle(!!this.task.date);
	}

	private renderSubtasks() {
		const el = this.subtasksEl;
		el.empty();
		const t = this.task;
		t.subtasks.forEach((s, i) => {
			const item = el.createDiv({ cls: "ch-task-sub-item" });
			const row = item.createDiv({ cls: "ch-task-sub-row" });
			const cb = row.createEl("input", { type: "checkbox", cls: "ch-task-check" });
			cb.checked = s.done;
			cb.onchange = () => (s.done = cb.checked);
			const txt = row.createEl("input", { type: "text", cls: "ch-input" });
			txt.value = s.title;
			txt.addEventListener("input", () => (s.title = txt.value));
			// ≡ opens the subtask's description and notes on demand (kept closed, so the dialog stays short).
			const open = this.openSubs.has(s.id);
			const more = row.createEl("button", { cls: "ch-icon-btn ch-sub-extra-btn", attr: { "aria-label": "Description and notes", "aria-expanded": String(open) } });
			more.toggleClass("has-content", !!s.description || s.links.length > 0);
			more.toggleClass("is-active", open);
			setIcon(more, "align-left");
			more.onclick = () => {
				if (open) this.openSubs.delete(s.id);
				else this.openSubs.add(s.id);
				this.renderSubtasks();
			};
			const del = row.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Remove subtask" } });
			setIcon(del, "x");
			del.onclick = () => {
				t.subtasks.splice(i, 1);
				this.renderSubtasks();
			};
			if (!open) return;
			const extra = item.createDiv({ cls: "ch-task-sub-extra" });
			const desc = extra.createEl("textarea", { cls: "ch-input ch-sub-desc", attr: { rows: "2", placeholder: "Short description (optional)" } });
			desc.value = s.description ?? "";
			desc.addEventListener("input", () => (s.description = desc.value || undefined));
			linkedNotesBlock(this.plugin, extra, {
				get: () => s.links,
				set: (links) => void (s.links = links),
				extra: {
					label: this.plugin.hasTaskNote(t, s) ? "Open note" : "Create note", icon: "file-plus", cls: "ch-create-note-btn",
					run: () => this.createNote(s.id),
				},
			});
		});
	}

	/** Problems that stop saving, or null. */
	private problem(): string | null {
		const t = this.task;
		if (!t.title.trim()) return "Please enter a title.";
		if (t.start && t.end && t.end <= t.start) return "The end time must be after the start time.";
		return null;
	}

	/** "Create note" for the task or one subtask: save the task with the note linked, close, open the note. */
	private async createNote(subId?: string) {
		const p = this.problem();
		if (p) {
			new Notice(p);
			return;
		}
		const t = this.task;
		t.title = t.title.trim();
		const sub = subId ? t.subtasks.find((x) => x.id === subId) : undefined;
		if (subId && !sub?.title.trim()) {
			new Notice("Give the subtask a title first.");
			return;
		}
		const file = await this.plugin.createNoteForTask(t, sub, false);
		if (!file) return;
		const owner = sub ?? t;
		if (!owner.links.includes(file.path)) owner.links.push(file.path);
		await this.save();
	}

	private async save() {
		const t = this.task;
		const p = this.problem();
		if (p) {
			new Notice(p);
			return;
		}
		t.title = t.title.trim();
		t.subtasks = t.subtasks.filter((s) => s.title.trim());
		for (const s of t.subtasks) s.description = s.description?.trim() || undefined;
		await this.plugin.tasks.upsert(t);
		this.close();
	}

	private async delete() {
		const ok = await confirmAction(this.app, "Delete task", `Delete “${this.task.title || "this task"}”?`);
		if (!ok) return;
		await this.plugin.tasks.remove(this.task.id);
		this.close();
	}
}
