import { Modal, Setting } from "obsidian";
import type CalendarHubPlugin from "../main";
import { CalendarOccurrence } from "../types";
import { describeWhen } from "../notes";
import { EventModal } from "./EventModal";

/** Strip HTML that some providers (Outlook) put into descriptions. */
function plainText(s: string): string {
	if (!/<[a-z][\s\S]*>/i.test(s)) return s;
	const doc = new DOMParser().parseFromString(s, "text/html");
	return doc.body.textContent ?? s;
}

/** Read-only details for events from subscribed (external) calendars. */
export class EventDetailsModal extends Modal {
	constructor(private plugin: CalendarHubPlugin, private occ: CalendarOccurrence) {
		super(plugin.app);
	}

	onOpen() {
		const { contentEl, occ } = this;
		const source = this.plugin.store.getSource(occ.sourceId);
		this.modalEl.addClass("ch-details-modal");
		this.setTitle(occ.title);

		const meta = contentEl.createDiv({ cls: "ch-details" });
		const cal = meta.createDiv({ cls: "ch-details-row" });
		cal.createSpan({ cls: "ch-dot" }).style.backgroundColor = occ.color;
		cal.createSpan({ text: `${source?.name ?? "Calendar"}${occ.readOnly ? " (read-only)" : ""}` });

		meta.createDiv({ cls: "ch-details-row", text: `🕒 ${describeWhen(occ, this.plugin.settings.use24h)}` });
		if (occ.recurring) meta.createDiv({ cls: "ch-details-row ch-muted", text: "↻ Recurring event" });
		if (occ.location) meta.createDiv({ cls: "ch-details-row", text: `📍 ${occ.location}` });
		if (occ.url) {
			const row = meta.createDiv({ cls: "ch-details-row" });
			row.appendText("🔗 ");
			row.createEl("a", { text: occ.url, href: occ.url });
		}
		if (occ.description) {
			contentEl.createDiv({ cls: "ch-details-description", text: plainText(occ.description) });
		}

		const buttons = new Setting(contentEl).setClass("ch-modal-buttons");
		buttons.addButton((b) =>
			b.setButtonText("Copy to local calendar").onClick(() => {
				this.close();
				new EventModal(this.plugin, {
					title: occ.title,
					start: occ.start,
					end: occ.end,
					allDay: occ.allDay,
					location: occ.location,
					description: occ.description ? plainText(occ.description) : undefined,
				}).open();
			})
		);
		buttons.addButton((b) =>
			b.setButtonText("Create note").setCta().onClick(async () => {
				await this.plugin.openNoteForOccurrence(occ);
				this.close();
			})
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
