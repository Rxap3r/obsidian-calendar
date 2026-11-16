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

/**
 * A question with several answers (buttons, the last one highlighted unless marked as a warning).
 * Resolves with the chosen value, or null when the dialog was closed.
 */
export function chooseAction<T extends string>(
	app: App, title: string, message: string, choices: { label: string; value: T; warning?: boolean }[]
): Promise<T | null> {
	return new Promise((resolve) => {
		let answer: T | null = null;
		const modal = new (class extends Modal {
			onOpen() {
				this.setTitle(title);
				this.contentEl.createEl("p", { text: message });
				const buttons = new Setting(this.contentEl).setClass("ch-modal-buttons");
				buttons.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
				for (const c of choices) {
					buttons.addButton((b) => {
						b.setButtonText(c.label).onClick(() => {
							answer = c.value;
							this.close();
						});
						if (c.warning) b.setWarning();
					});
				}
			}
			onClose() {
				this.contentEl.empty();
				resolve(answer);
			}
		})(app);
		modal.open();
	});
}
