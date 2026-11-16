import { setIcon } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { NotePickerModal } from "../modals/NotePickerModal";
import { noteName, openLinkedNote } from "./tasks/helpers";

export interface LinkedNotesOptions {
	/** The current links. */
	get(): string[];
	/** Store new links (the block re-renders afterwards). */
	set(links: string[]): void | Promise<void>;
	/** Extra button in the heading, e.g. "Create note" for events. */
	extra?: { label: string; icon: string; cls: string; run: () => void | Promise<void> };
}

/**
 * "Linked notes" in the task and event dialogs: a heading with "Link note", then one row per note
 * (click opens it, × removes the link). The notes themselves are never changed.
 */
export function linkedNotesBlock(plugin: OmniCalendarPlugin, container: HTMLElement, opts: LinkedNotesOptions): { render: () => void } {
	const head = container.createDiv({ cls: "ch-task-section-head" });
	head.createSpan({ text: "Linked notes" });
	const buttons = head.createDiv({ cls: "ch-section-buttons" });
	if (opts.extra) {
		const x = opts.extra;
		const b = buttons.createEl("button", { cls: `ch-task-link-btn ${x.cls}`, text: x.label });
		setIcon(b.createSpan({ cls: "ch-btn-icon" }), x.icon);
		b.onclick = () => void x.run();
	}
	const link = buttons.createEl("button", { cls: "ch-task-link-btn ch-link-note-btn", text: "Link note" });
	setIcon(link.createSpan({ cls: "ch-btn-icon" }), "link");
	const list = container.createDiv({ cls: "ch-task-links" });

	const render = () => {
		list.empty();
		const links = opts.get();
		if (!links.length) list.createDiv({ cls: "ch-empty ch-task-links-empty", text: "No linked notes" });
		for (const path of links) {
			const row = list.createDiv({ cls: "ch-task-link-row" });
			setIcon(row.createSpan({ cls: "ch-task-link-icon" }), "file-text");
			const name = row.createEl("a", { cls: "ch-task-link-name", text: noteName(path), attr: { title: path } });
			name.onclick = (e) => {
				e.preventDefault();
				void openLinkedNote(plugin, path);
			};
			const del = row.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Remove link" } });
			setIcon(del, "x");
			del.onclick = async () => {
				await opts.set(opts.get().filter((p) => p !== path));
				render();
			};
		}
	};
	link.onclick = () =>
		new NotePickerModal(plugin.app, plugin.settings.notesFolder, opts.get(), async (path) => {
			const links = opts.get();
			if (!links.includes(path)) await opts.set([...links, path]);
			render();
		}).open();
	render();
	return { render };
}
