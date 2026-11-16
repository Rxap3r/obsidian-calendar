import { EventRef, Modal, setIcon } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { formatDate, parseLocal } from "../dateUtils";
import { keepFocusOnTap } from "../pickers";
import { renderTaskRow } from "../views/tasks/taskRow";
import { TaskModal } from "./TaskModal";

/**
 * The tasks of one day, opened from the day's counter (☐ 3) in the calendar: tick off, open, add.
 * Shows what the calendar counts for that day (tasks of events are on their event instead).
 */
export class DayTasksModal extends Modal {
	private listEl!: HTMLElement;
	private ref: EventRef | null = null;
	private collapsed = new Set<string>();

	constructor(private plugin: OmniCalendarPlugin, private date: string) {
		super(plugin.app);
	}

	onOpen() {
		const { contentEl } = this;
		this.modalEl.addClass("ch-day-tasks-modal");
		keepFocusOnTap(this.modalEl);
		this.setTitle(`Tasks · ${formatDate(parseLocal(this.date), { weekday: "long", day: "numeric", month: "long" })}`);
		const add = contentEl.createEl("input", { type: "text", cls: "ch-input ch-day-tasks-add", attr: { placeholder: "+ Add a task for this day (Enter)" } });
		add.addEventListener("keydown", (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			const title = add.value.trim();
			if (!title) return;
			add.value = "";
			void this.plugin.tasks.upsert(this.plugin.tasks.draft({ title, date: this.date }));
		});
		this.listEl = contentEl.createDiv({ cls: "ch-tasks-list ch-day-tasks-list" });
		const foot = contentEl.createDiv({ cls: "ch-day-tasks-foot" });
		const more = foot.createEl("button", { cls: "ch-day-tasks-new" });
		setIcon(more.createSpan({ cls: "ch-btn-icon" }), "plus");
		more.appendText("New task…");
		more.onclick = () => new TaskModal(this.plugin, undefined, { date: this.date }).open();
		const open = foot.createEl("button", { text: "Open tasks" });
		open.onclick = () => {
			this.close();
			void this.plugin.openTasks("upcoming");
		};
		this.ref = this.plugin.tasks.on("changed", () => this.render());
		this.render();
	}

	private render() {
		const el = this.listEl;
		el.empty();
		const tasks = this.plugin.tasks.forCalendarDay(this.date);
		if (!tasks.length) el.createDiv({ cls: "ch-empty", text: "No tasks on this day" });
		for (const t of tasks) {
			renderTaskRow(this.plugin, el, t, {
				showDate: false,
				showList: true,
				collapsed: this.collapsed.has(t.id),
				onToggleSubtasks: () => {
					if (!this.collapsed.delete(t.id)) this.collapsed.add(t.id);
					this.render();
				},
			});
		}
	}

	onClose() {
		if (this.ref) this.plugin.tasks.offref(this.ref);
		this.contentEl.empty();
	}
}
