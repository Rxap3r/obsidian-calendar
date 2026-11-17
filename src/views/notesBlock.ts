import { Notice, setIcon } from "obsidian";
import { errorMessage } from "../util";

export interface NotesBlockOptions {
	/** Heading, e.g. "Description" or "Notes". */
	label: string;
	/** The text as it is now ("" = none). */
	text: string;
	/** Shown when there is no text. */
	empty: string;
	/** Store the new text; undefined = not editable (read-only calendars). */
	save?: (text: string) => Promise<void>;
	/** Small grey line under the field while editing, e.g. "Saved to Google Calendar". */
	hint?: string;
	/** Told when editing starts / ends (the details view doesn't redraw itself meanwhile). */
	onEditing?: (editing: boolean) => void;
}

/**
 * The description of an event / notes of a task in the details view: read-only text with a small "Edit notes" button.
 * Only that button turns it into a text field with Save / Cancel – clicking the text itself changes nothing.
 */
export function notesBlock(container: HTMLElement, o: NotesBlockOptions) {
	const wrap = container.createDiv({ cls: "ch-details-notes" });
	const show = () => {
		wrap.empty();
		const head = wrap.createDiv({ cls: "ch-details-notes-head" });
		head.createSpan({ cls: "ch-details-label", text: o.label });
		if (o.save) {
			const edit = head.createEl("button", { cls: "ch-details-edit-notes", text: "Edit notes" });
			setIcon(edit.createSpan({ cls: "ch-btn-icon" }), "pencil");
			edit.onclick = () => editing();
		}
		if (o.text.trim()) wrap.createDiv({ cls: "ch-details-description", text: o.text });
		else wrap.createDiv({ cls: "ch-empty ch-details-notes-empty", text: o.empty });
	};
	const editing = () => {
		o.onEditing?.(true);
		wrap.empty();
		wrap.createDiv({ cls: "ch-details-notes-head" }).createSpan({ cls: "ch-details-label", text: o.label });
		const field = wrap.createEl("textarea", { cls: "ch-input ch-details-notes-field" });
		field.value = o.text;
		field.rows = Math.min(12, Math.max(4, o.text.split("\n").length + 1));
		if (o.hint) wrap.createDiv({ cls: "ch-muted ch-small-hint", text: o.hint });
		const buttons = wrap.createDiv({ cls: "ch-details-notes-buttons" });
		const cancel = buttons.createEl("button", { text: "Cancel" });
		const save = buttons.createEl("button", { text: "Save", cls: "mod-cta" });
		cancel.onclick = () => {
			o.onEditing?.(false);
			show();
		};
		save.onclick = async () => {
			if (!o.save) return;
			save.disabled = true;
			try {
				await o.save(field.value.trim());
				o.text = field.value.trim();
				o.onEditing?.(false);
				show();
			} catch (e) {
				new Notice(`Could not save: ${errorMessage(e)}`, 8000);
				save.disabled = false;
			}
		};
		window.setTimeout(() => field.focus(), 10);
	};
	show();
}
