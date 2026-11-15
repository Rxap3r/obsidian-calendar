import { Modal, Notice, Setting, setIcon } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { Task, TaskPriority } from "../types";
import { PRIORITY_NAMES, newSubtask } from "../tasks";
import { addDays, toDateKey } from "../dateUtils";
import { confirmAction } from "./ConfirmModal";
import { NotePickerModal } from "./NotePickerModal";
import { openLinkedNote } from "../views/TasksView";

/** Create / edit a task: title, list, priority, date, time (range), subtasks, linked notes, notes. */
export class TaskModal extends Modal {
	static openCount = 0;
	private task: Task;
	private readonly isNew: boolean;
	private timeRow!: HTMLElement;
	private subtasksEl!: HTMLElement;
	private linksEl!: HTMLElement;
	private dateInput!: HTMLInputElement;

	constructor(private plugin: OmniCalendarPlugin, task?: Task, init: Partial<Task> = {}) {
		super(plugin.app);
		this.isNew = !task || !plugin.tasks.get(task.id);
		// Edit a copy; nothing changes until "Save".
		this.task = task ? JSON.parse(JSON.stringify(task)) : plugin.tasks.draft(init);
	}

	onOpen() {
		TaskModal.openCount++;
		const { contentEl } = this;
		const t = this.task;
		this.modalEl.addClass("ch-event-modal", "ch-task-modal");
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
		this.dateInput = date.controlEl.createEl("input", { type: "date", cls: "ch-input" });
		this.dateInput.value = t.date ?? "";
		this.dateInput.addEventListener("change", () => this.setDate(this.dateInput.value || undefined));
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
		const from = time.controlEl.createEl("input", { type: "time", cls: "ch-input ch-task-start" });
		from.value = t.start ?? "";
		time.controlEl.createSpan({ cls: "ch-task-time-sep", text: "to" });
		const to = time.controlEl.createEl("input", { type: "time", cls: "ch-input ch-task-end" });
		to.value = t.end ?? "";
		from.addEventListener("change", () => {
			t.start = from.value || undefined;
			if (!t.start) {
				t.end = undefined;
				to.value = "";
			}
		});
		to.addEventListener("change", () => (t.end = to.value || undefined));
		const clear = time.controlEl.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Clear time" } });
		setIcon(clear, "x");
		clear.onclick = () => {
			t.start = t.end = undefined;
			from.value = to.value = "";
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
		const lh = contentEl.createDiv({ cls: "ch-task-section-head" });
		lh.createSpan({ text: "Linked notes" });
		const link = lh.createEl("button", { cls: "ch-task-link-btn", text: "Link note" });
		setIcon(link.createSpan({ cls: "ch-btn-icon" }), "link");
		link.onclick = () =>
			new NotePickerModal(this.app, this.plugin.settings.notesFolder, t.links, (path) => {
				if (!t.links.includes(path)) t.links.push(path);
				this.renderLinks();
			}).open();
		this.linksEl = contentEl.createDiv({ cls: "ch-task-links" });
		this.renderLinks();

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
		TaskModal.openCount = Math.max(0, TaskModal.openCount - 1);
		this.contentEl.empty();
	}

	private setDate(value: string | undefined) {
		this.task.date = value;
		this.dateInput.value = value ?? "";
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
			const row = el.createDiv({ cls: "ch-task-sub-row" });
			const cb = row.createEl("input", { type: "checkbox", cls: "ch-task-check" });
			cb.checked = s.done;
			cb.onchange = () => (s.done = cb.checked);
			const txt = row.createEl("input", { type: "text", cls: "ch-input" });
			txt.value = s.title;
			txt.addEventListener("input", () => (s.title = txt.value));
			const del = row.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Remove subtask" } });
			setIcon(del, "x");
			del.onclick = () => {
				t.subtasks.splice(i, 1);
				this.renderSubtasks();
			};
		});
	}

	private renderLinks() {
		const el = this.linksEl;
		el.empty();
		const t = this.task;
		if (!t.links.length) el.createDiv({ cls: "ch-empty ch-task-links-empty", text: "No linked notes" });
		for (const path of t.links) {
			const row = el.createDiv({ cls: "ch-task-link-row" });
			setIcon(row.createSpan({ cls: "ch-task-link-icon" }), "file-text");
			const name = row.createEl("a", { cls: "ch-task-link-name", text: path.replace(/\.md$/, "").split("/").pop() ?? path, attr: { title: path } });
			name.onclick = (e) => {
				e.preventDefault();
				void openLinkedNote(this.plugin, path);
			};
			const del = row.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Remove link" } });
			setIcon(del, "x");
			del.onclick = () => {
				t.links = t.links.filter((p) => p !== path);
				this.renderLinks();
			};
		}
	}

	private async save() {
		const t = this.task;
		t.title = t.title.trim();
		if (!t.title) {
			new Notice("Please enter a title.");
			return;
		}
		t.subtasks = t.subtasks.filter((s) => s.title.trim());
		if (t.start && t.end && t.end <= t.start) {
			new Notice("The end time must be after the start time.");
			return;
		}
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
