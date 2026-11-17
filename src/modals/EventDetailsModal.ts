import { EventRef, Modal, Setting } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { CalendarOccurrence } from "../types";
import { describeWhen } from "../notes";
import { toDateKey } from "../dateUtils";
import { eventKey } from "../eventLinks";
import { EventModal } from "./EventModal";
import { eventExtras } from "../views/eventExtras";
import { notesBlock } from "../views/notesBlock";
import { editOccurrence } from "../views/shared";

/** Strip HTML that some providers (Outlook) put into descriptions. */
export function plainText(s: string): string {
	if (!/<[a-z][\s\S]*>/i.test(s)) return s;
	const doc = new DOMParser().parseFromString(s, "text/html");
	return doc.body.textContent ?? s;
}

/**
 * The details view of an event (1.9): everything at a glance, nothing changed by accident. Quick actions stay possible:
 * "Edit notes" (only the description), ticking off the event's tasks, its linked notes. "Edit" opens the edit dialog.
 * Read-only calendars (ICS, read-only Google / Outlook) get the same view without the editing parts.
 */
export class EventDetailsModal extends Modal {
	private stopExtras: (() => void) | null = null;
	private ref: EventRef | null = null;
	/** The description is being edited: don't redraw (that would throw away what is typed). */
	private editing = false;

	constructor(private plugin: OmniCalendarPlugin, private occ: CalendarOccurrence) {
		super(plugin.app);
	}

	onOpen() {
		EventModal.openCount++;
		this.modalEl.addClass("ch-details-modal");
		// Redraw when the event changes (e.g. its description was saved, or Google sent a newer version).
		this.ref = this.plugin.store.on("changed", () => {
			if (!this.editing) this.refresh();
		});
		this.render();
	}

	/** Look the event up again; close when it is gone (deleted). */
	private refresh() {
		const now = this.plugin.store.findOccurrence(eventKey(this.occ), toDateKey(this.occ.start));
		if (!now) {
			this.close();
			return;
		}
		this.occ = now;
		this.render();
	}

	private render() {
		const { contentEl, occ, plugin } = this;
		this.stopExtras?.();
		contentEl.empty();
		const source = plugin.store.getSource(occ.sourceId);
		this.setTitle(occ.title);

		const meta = contentEl.createDiv({ cls: "ch-details" });
		const cal = meta.createDiv({ cls: "ch-details-row" });
		cal.createSpan({ cls: "ch-dot" }).style.backgroundColor = occ.color;
		cal.createSpan({ text: `${source?.name ?? "Calendar"}${occ.readOnly ? " (read-only)" : ""}` });
		meta.createDiv({ cls: "ch-details-row", text: `🕒 ${describeWhen(occ, plugin.settings.use24h)}` });
		if (occ.recurring) meta.createDiv({ cls: "ch-details-row ch-muted", text: "↻ Repeating event" });
		if (occ.location) meta.createDiv({ cls: "ch-details-row", text: `📍 ${occ.location}` });
		if (occ.url) {
			const row = meta.createDiv({ cls: "ch-details-row" });
			row.appendText("🔗 ");
			row.createEl("a", { text: occ.url, href: occ.url });
		}

		notesBlock(contentEl, {
			label: "Description",
			text: occ.description ? plainText(occ.description) : "",
			empty: "No description",
			save: occ.readOnly ? undefined : (text) => this.saveDescription(text),
			hint: this.saveHint(),
			onEditing: (on) => {
				this.editing = on;
				if (!on) window.setTimeout(() => this.refresh(), 0);
			},
		});

		this.stopExtras = eventExtras(plugin, contentEl.createDiv({ cls: "ch-event-extras" }), occ, { afterCreateNote: () => this.close() });

		const buttons = new Setting(contentEl).setClass("ch-modal-buttons");
		if (occ.readOnly) {
			buttons.addButton((b) =>
				b.setButtonText("Copy to local calendar").onClick(() => {
					this.close();
					new EventModal(plugin, {
						title: occ.title, start: occ.start, end: occ.end, allDay: occ.allDay, location: occ.location,
						description: occ.description ? plainText(occ.description) : undefined,
					}).open();
				})
			);
		}
		buttons.addButton((b) => b.setButtonText("Close").onClick(() => this.close()));
		if (!occ.readOnly) {
			buttons.addButton((b) =>
				b.setButtonText("Edit").setCta().onClick(() => {
					this.close();
					editOccurrence(plugin, occ);
				})
			);
		}
	}

	/** Where "Edit notes" saves to, shown under the field. */
	private saveHint(): string | undefined {
		const occ = this.occ;
		if (occ.remote) return `Saved to ${this.plugin.store.serviceName(occ.sourceId)}${occ.recurring ? " (this occurrence)" : ""}.`;
		if (occ.recurring) return "Applies to all occurrences of this event.";
		return undefined;
	}

	/** "Edit notes": only the description changes – locally, or in Google / Outlook. */
	private async saveDescription(text: string) {
		const occ = this.occ;
		const store = this.plugin.store;
		if (occ.remote) {
			await store.updateRemote(occ, {
				title: occ.title, allDay: occ.allDay, start: occ.start, end: occ.end, location: occ.location, description: text || undefined,
			});
		} else if (occ.eventId) {
			await store.updateEvent(occ.eventId, { description: text || undefined });
		}
	}

	onClose() {
		EventModal.openCount = Math.max(0, EventModal.openCount - 1);
		this.stopExtras?.();
		if (this.ref) this.plugin.store.offref(this.ref);
		this.contentEl.empty();
	}
}
