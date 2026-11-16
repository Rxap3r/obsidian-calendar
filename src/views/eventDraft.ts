import { setIcon } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { linkedNotesBlock } from "./linkedNotes";

/** Tasks and linked notes typed into the dialog of a **new** event; they are attached when it is saved. */
export interface EventDraft {
	tasks: string[];
	links: string[];
}

/**
 * The Tasks and Linked notes sections of the new-event dialog. Nothing is stored until the event is
 * saved (`attachDraft`); Cancel simply forgets it. "Create note" needs the saved event and is offered afterwards.
 */
export function draftExtras(plugin: OmniCalendarPlugin, container: HTMLElement, draft: EventDraft): { setHint: (text: string) => void } {
	const hint = container.createDiv({ cls: "ch-modal-hint ch-muted ch-extras-hint" });
	hint.hide();
	if (plugin.settings.tasksEnabled) {
		const wrap = container.createDiv({ cls: "ch-event-tasks" });
		wrap.createDiv({ cls: "ch-task-section-head" }).createSpan({ text: "Tasks" });
		const list = wrap.createDiv({ cls: "ch-event-task-list" });
		const add = wrap.createEl("input", { type: "text", cls: "ch-input ch-event-task-add", attr: { placeholder: "+ Add a task (Enter)" } });
		const render = () => {
			list.empty();
			draft.tasks.forEach((title, i) => {
				const row = list.createDiv({ cls: "ch-event-task ch-draft-task" });
				row.createSpan({ cls: "ch-task-checkbox ch-small ch-draft-check", attr: { "aria-hidden": "true" } });
				row.createSpan({ cls: "ch-event-task-title", text: title });
				const del = row.createEl("button", { cls: "ch-icon-btn", attr: { "aria-label": "Remove task" } });
				setIcon(del, "x");
				del.onclick = (e) => {
					e.stopPropagation();
					draft.tasks.splice(i, 1);
					render();
				};
			});
		};
		add.addEventListener("keydown", (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			const title = add.value.trim();
			if (!title) return;
			draft.tasks.push(title);
			add.value = "";
			render();
		});
		render();
	}
	linkedNotesBlock(plugin, container.createDiv({ cls: "ch-event-notes" }), {
		get: () => draft.links,
		set: (links) => void (draft.links = links),
	});
	return {
		setHint: (text) => {
			hint.setText(text);
			hint.toggle(!!text);
		},
	};
}

/** Attach the draft to the saved event (`key` = its `eventKey()`, `date` = its first day), then empty it. */
export async function attachDraft(plugin: OmniCalendarPlugin, draft: EventDraft, key: string, title: string, date: string) {
	for (const t of draft.tasks) await plugin.tasks.upsert(plugin.tasks.draft({ title: t, date, event: { key, title, date } }));
	await plugin.store.setLinksAt(key, draft.links);
	draft.tasks = [];
	draft.links = [];
}
