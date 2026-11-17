import { Notice, Platform, setIcon } from "obsidian";
import type OmniCalendarPlugin from "../../main";
import { Task, TaskLogEntry } from "../../types";
import { dayTitle } from "../../tasks";
import { formatDate, formatTimeKey, toDateKey, toTimeKey } from "../../dateUtils";
import { confirmAction } from "../../modals/ConfirmModal";
import { errorMessage } from "../../util";

/** What the details view keeps between redraws: the text being typed into the "add" field. */
export interface LogDraft {
	text: string;
}

export interface ProgressLogOptions {
	draft: LogDraft;
	/** Told when an entry is being edited (the details view doesn't redraw itself meanwhile). */
	onEditing: (editing: boolean) => void;
}

/** "1 entry", "3 entries". */
export function entryCount(n: number): string {
	return `${n} ${n === 1 ? "entry" : "entries"}`;
}

/** "Today · 14:30", "Mon, 9 Nov · 14:30" (with the year when it isn't this year). */
export function logTimeLabel(at: number, use24h: boolean): string {
	const d = new Date(at);
	const day = dayTitle(toDateKey(d));
	const date = ["Today", "Yesterday"].includes(day)
		? day
		: formatDate(d, { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
	return `${date} · ${formatTimeKey(toTimeKey(d), use24h)}`;
}

/**
 * The progress log of a task in the details view (1.9.2): timestamped entries, oldest first and the newest at the
 * bottom, plus a field to add one. Entries can be edited (their time stays) or deleted. Separate from subtasks.
 */
export function progressLogBlock(plugin: OmniCalendarPlugin, container: HTMLElement, task: Task, o: ProgressLogOptions) {
	const store = plugin.tasks;
	const log = task.log ?? [];
	const wrap = container.createDiv({ cls: "ch-log" });
	wrap.style.setProperty("--ch-event-color", store.list(task.listId).color);
	const head = wrap.createDiv({ cls: "ch-task-section-head" });
	head.createSpan({ text: "Progress log" });
	if (log.length) head.createSpan({ cls: "ch-log-count", text: entryCount(log.length) });

	const list = wrap.createDiv({ cls: "ch-log-entries" });
	if (!log.length) list.createDiv({ cls: "ch-empty ch-log-empty", text: "No entries yet. Note what happened, step by step." });
	for (const e of log) entryRow(plugin, list, task, e, o);

	// Add an entry. Enter sends on a computer (Shift+Enter = new line); on phones the button does.
	const add = wrap.createDiv({ cls: "ch-log-add" });
	const input = add.createEl("textarea", { cls: "ch-input ch-log-input", attr: { rows: "1", placeholder: "Add an update…", "aria-label": "New progress log entry" } });
	input.value = o.draft.text;
	const grow = () => {
		input.style.height = "auto";
		input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
	};
	const send = add.createEl("button", { cls: "ch-log-send mod-cta", attr: { "aria-label": "Add entry" } });
	setIcon(send, "send");
	const submit = async () => {
		const text = input.value.trim();
		if (!text) return;
		send.disabled = true;
		o.draft.text = "";
		try {
			await store.addLog(task.id, text);
		} catch (err) {
			o.draft.text = text;
			send.disabled = false;
			new Notice(`Couldn't add the entry: ${errorMessage(err)}`);
		}
	};
	input.addEventListener("input", () => {
		o.draft.text = input.value;
		grow();
	});
	input.addEventListener("keydown", (ev) => {
		if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing && !Platform.isMobile) {
			ev.preventDefault();
			void submit();
		}
	});
	send.onclick = () => void submit();
	if (o.draft.text) window.requestAnimationFrame(grow);
}

function entryRow(plugin: OmniCalendarPlugin, list: HTMLElement, task: Task, e: TaskLogEntry, o: ProgressLogOptions) {
	const store = plugin.tasks;
	const row = list.createDiv({ cls: "ch-log-entry" });
	const show = () => {
		row.empty();
		const top = row.createDiv({ cls: "ch-log-entry-head" });
		const time = top.createSpan({ cls: "ch-log-time", text: logTimeLabel(e.at, plugin.settings.use24h) });
		if (e.editedAt) {
			time.createSpan({ cls: "ch-log-edited", text: " · edited" });
			time.setAttr("title", `Edited ${logTimeLabel(e.editedAt, plugin.settings.use24h)}`);
		}
		const actions = top.createSpan({ cls: "ch-log-actions" });
		const edit = actions.createEl("button", { cls: "ch-log-action ch-log-edit", attr: { "aria-label": "Edit entry" } });
		setIcon(edit, "pencil");
		edit.onclick = () => editing();
		const del = actions.createEl("button", { cls: "ch-log-action ch-log-delete", attr: { "aria-label": "Delete entry" } });
		setIcon(del, "trash-2");
		del.onclick = async () => {
			if (await confirmAction(plugin.app, "Delete entry", "Delete this progress log entry? This can't be undone.")) await store.removeLog(task.id, e.id);
		};
		row.createDiv({ cls: "ch-log-text", text: e.text });
	};
	const editing = () => {
		o.onEditing(true);
		row.empty();
		row.createDiv({ cls: "ch-log-entry-head" }).createSpan({ cls: "ch-log-time", text: logTimeLabel(e.at, plugin.settings.use24h) });
		const field = row.createEl("textarea", { cls: "ch-input ch-log-edit-field" });
		field.value = e.text;
		field.rows = Math.min(8, Math.max(2, e.text.split("\n").length + 1));
		const buttons = row.createDiv({ cls: "ch-details-notes-buttons" });
		const cancel = buttons.createEl("button", { text: "Cancel" });
		const save = buttons.createEl("button", { text: "Save", cls: "mod-cta" });
		cancel.onclick = () => {
			o.onEditing(false);
			show();
		};
		save.onclick = async () => {
			// An empty entry isn't saved; deleting is its own button.
			if (!field.value.trim()) {
				new Notice("The entry is empty. Use the bin icon to delete it.");
				return;
			}
			save.disabled = true;
			await store.editLog(task.id, e.id, field.value);
			o.onEditing(false);
		};
		if (!Platform.isMobile) field.focus();
	};
	show();
}
