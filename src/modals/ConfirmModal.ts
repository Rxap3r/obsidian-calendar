import { App, Modal, Setting } from "obsidian";

/** Simple yes/no confirmation that works on desktop and mobile. */
export function confirmAction(app: App, title: string, message: string, confirmText = "Delete"): Promise<boolean> {
	return new Promise((resolve) => {
		let done = false;
		const modal = new (class extends Modal {
			onOpen() {
				this.setTitle(title);
				this.contentEl.createEl("p", { text: message });
				new Setting(this.contentEl)
					.setClass("ch-modal-buttons")
					.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
					.addButton((b) =>
						b.setButtonText(confirmText).setWarning().onClick(() => {
							done = true;
							resolve(true);
							this.close();
						})
					);
			}
			onClose() {
				this.contentEl.empty();
				if (!done) resolve(false);
			}
		})(app);
		modal.open();
	});
}
