import { Modal, Notice, Setting } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { TaskList } from "../types";
import { nextColor } from "../defaults";

/** Small dialog: list name + colour. */
export class ListModal extends Modal {
	private name: string;
	private color: string;
	constructor(private plugin: OmniCalendarPlugin, private list: TaskList | undefined, private done: (created?: TaskList) => void) {
		super(plugin.app);
		this.name = list?.name ?? "";
		this.color = list?.color ?? nextColor(plugin.tasks.lists.map((x) => x.color), plugin.tasks.lists.length);
	}
	onOpen() {
		this.setTitle(this.list ? "Edit list" : "New list");
		this.modalEl.addClass("ch-list-modal");
		new Setting(this.contentEl).setName("Name").addText((t) => {
			t.setPlaceholder("e.g. Work").setValue(this.name).onChange((v) => (this.name = v));
			t.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					void this.save();
				}
			});
			window.setTimeout(() => t.inputEl.focus(), 10);
		});
		new Setting(this.contentEl).setName("Colour").addColorPicker((c) => c.setValue(this.color).onChange((v) => (this.color = v)));
		new Setting(this.contentEl)
			.setClass("ch-modal-buttons")
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((b) => b.setButtonText(this.list ? "Save" : "Create").setCta().onClick(() => void this.save()));
	}
	onClose() {
		this.contentEl.empty();
	}
	private async save() {
		const name = this.name.trim();
		if (!name) {
			new Notice("Please enter a name.");
			return;
		}
		if (this.list) {
			await this.plugin.tasks.updateList(this.list.id, { name, color: this.color });
			this.done();
		} else {
			this.done(await this.plugin.tasks.addList(name, this.color));
		}
		this.close();
	}
}
