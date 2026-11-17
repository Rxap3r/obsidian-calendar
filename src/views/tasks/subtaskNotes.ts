import { Menu, Notice } from "obsidian";
import type OmniCalendarPlugin from "../../main";
import { Subtask, Task } from "../../types";
import { NotePickerModal } from "../../modals/NotePickerModal";
import { noteName } from "./helpers";

/**
 * The small "⋯" menu of a subtask in the details view (1.9.3): Create / Open note, Link note….
 * Opened by a tap or click on its button, so it works on phones too (no long-press needed).
 */
export function subtaskNoteMenu(plugin: OmniCalendarPlugin, t: Task, sub: Subtask, e: MouseEvent) {
	const store = plugin.tasks;
	const menu = new Menu();
	menu.addItem((i) =>
		i.setTitle(plugin.hasTaskNote(t, sub) ? "Open note" : "Create note").setIcon("file-plus").onClick(() => {
			if (!sub.title.trim()) {
				new Notice("Give the subtask a title first.");
				return;
			}
			void plugin.createNoteForTask(t, sub);
		})
	);
	menu.addItem((i) =>
		i.setTitle("Link note…").setIcon("link").onClick(() =>
			new NotePickerModal(plugin.app, plugin.settings.notesFolder, sub.links, (path) => void store.addLink(t.id, path, sub.id)).open()
		)
	);
	if (sub.links.length) {
		menu.addSeparator();
		for (const path of sub.links) {
			menu.addItem((i) =>
				i.setTitle(`Remove link: ${noteName(path)}`).setIcon("x").onClick(() =>
					void store.setSubtaskLinks(t.id, sub.id, sub.links.filter((p) => p !== path))
				)
			);
		}
	}
	menu.showAtMouseEvent(e);
}
