import { Notice, Setting, setIcon } from "obsidian";
import type { EventNow } from "../store";
import type OmniCalendarPlugin from "../main";
import { linkedNotesBlock } from "./linkedNotes";

/** Tasks and linked notes typed into the dialog of a **new** event; they are attached when it is saved. */
export interface EventDraft {
	tasks: string[];
	links: string[];
	/** "Track as task" switched on. */
	track: boolean;
}

/**
 * The Tasks and Linked notes sections of the new-event dialog. Nothing is stored until the event is
 * saved (`attachDraft`); Cancel simply forgets it. "Create note" needs the saved event and is offered afterwards.
 */
export function draftExtras(plugin: OmniCalendarPlugin, container: HTMLElement, draft: EventDraft): { setHint: (text: string) => void } {
	const hint = container.createDiv({ cls: "ch-modal-hint ch-muted ch-extras-hint" });
	hint.hide();
	if (plugin.settings.tasksEnabled) {
		new Setting(container)
			.setName("Track as task")
			.setDesc("Show this event in your task lists, to tick it off when it's done.")
			.setClass("ch-track-setting")
			.addToggle((t) => t.setValue(draft.track).onChange((v) => (draft.track = v)));
		// The event's own tasks (setting "Tasks on events"; "Track as task" above stays either way).
		if (plugin.settings.tasksOnEvents) {
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

/** True when the draft has something to attach. */
export function draftHasContent(draft: EventDraft): boolean {
	return draft.tasks.length > 0 || draft.links.length > 0 || draft.track;
}

/**
 * Attach the draft to the saved event (`key` = its `eventKey()`, `now` = its title / first day / time), then empty it.
 * "Track as task" is skipped for repeating events (comes with 1.9).
 */
export async function attachDraft(plugin: OmniCalendarPlugin, draft: EventDraft, key: string, now: EventNow, repeating: boolean) {
	const { title, day: date } = now;
	for (const t of draft.tasks) await plugin.tasks.upsert(plugin.tasks.draft({ title: t, date, event: { key, title, date } }));
	await plugin.store.setLinksAt(key, draft.links);
	if (draft.track && repeating) new Notice("“Track as task” isn't available for repeating events yet.");
	else if (draft.track) await plugin.tasks.setTracked(key, now, true);
	draft.tasks = [];
	draft.links = [];
	draft.track = false;
}
