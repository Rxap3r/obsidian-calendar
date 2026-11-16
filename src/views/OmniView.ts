import { ItemView, WorkspaceLeaf } from "obsidian";
import type OmniCalendarPlugin from "../main";

/** What the plugin's views (Calendar, Mini calendar, Tasks) have in common. */
export abstract class OmniView extends ItemView {
	private renderQueued = false;

	constructor(leaf: WorkspaceLeaf, readonly plugin: OmniCalendarPlugin) {
		super(leaf);
	}

	abstract render(): void;

	/** Re-render once on the next frame, however many changes arrive until then. */
	protected queueRender() {
		if (this.renderQueued) return;
		this.renderQueued = true;
		window.requestAnimationFrame(() => {
			this.renderQueued = false;
			this.render();
		});
	}

	/** True when this view sits in the left or right sidebar (false while it isn't attached yet). */
	protected inSidebar(): boolean {
		try {
			return this.plugin.sidebar.contains(this.leaf);
		} catch {
			return false;
		}
	}
}
