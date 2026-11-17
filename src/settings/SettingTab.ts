import { App, PluginSettingTab, setIcon } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { SettingsContext } from "./controls";
import { sideScroll } from "../views/sideScroll";
import { calendarsTab } from "./calendarsTab";
import { accountsTab } from "./accountsTab";
import { displayTab } from "./displayTab";
import { tasksTab } from "./tasksTab";
import { notesTab } from "./notesTab";

type TabId = "calendars" | "accounts" | "display" | "tasks" | "notes";

/** The settings tabs, in the order of the tab bar. Each one is drawn by its own file in this folder. */
const TABS: { id: TabId; icon: string; label: string; render: (ctx: SettingsContext, el: HTMLElement) => void }[] = [
	{ id: "calendars", icon: "calendar-days", label: "Calendars", render: calendarsTab },
	{ id: "accounts", icon: "refresh-cw", label: "Google & Outlook", render: accountsTab },
	{ id: "display", icon: "layout-panel-left", label: "Display", render: displayTab },
	{ id: "tasks", icon: "check-square", label: "Tasks", render: tasksTab },
	{ id: "notes", icon: "file-text", label: "Notes", render: notesTab },
];

/** Settings → Omni Calendar: the tab bar and the frame around the tabs. */
export class OmniCalendarSettingTab extends PluginSettingTab implements SettingsContext {
	/** Last opened settings tab (kept while Obsidian runs). */
	private static tab: TabId = "calendars";
	private resetScroll = false;
	private stopScroll: (() => void) | null = null;

	constructor(app: App, readonly plugin: OmniCalendarPlugin) {
		super(app, plugin);
	}

	async save(rerender = false) {
		await this.plugin.persist();
		this.plugin.store.notify();
		if (rerender) this.display();
	}

	redraw() {
		this.display();
	}

	display(): void {
		const { containerEl } = this;
		// Re-rendering after a change keeps the scroll position; switching tabs starts at the top.
		const scroller = scrollParent(containerEl);
		const keepScroll = this.resetScroll ? 0 : scroller?.scrollTop ?? 0;
		this.resetScroll = false;
		containerEl.empty();
		containerEl.addClass("ch-settings");

		const barWrap = containerEl.createDiv({ cls: "ch-settings-tabs-wrap" });
		const bar = barWrap.createDiv({ cls: "ch-settings-tabs", attr: { role: "tablist" } });
		for (const { id, icon, label } of TABS) {
			const active = OmniCalendarSettingTab.tab === id;
			const btn = bar.createEl("button", { cls: `ch-settings-tab${active ? " is-active" : ""}`, attr: { role: "tab", "aria-selected": String(active) } });
			setIcon(btn.createSpan({ cls: "ch-settings-tab-icon" }), icon);
			btn.createSpan({ text: label });
			btn.onclick = () => {
				OmniCalendarSettingTab.tab = id;
				this.resetScroll = true;
				this.display();
			};
		}

		// When the tabs do not fit: a thin scrollbar (desktop), the mouse wheel and a faded edge.
		this.stopScroll?.();
		this.stopScroll = sideScroll(bar);
		window.requestAnimationFrame(() => {
			bar.querySelector<HTMLElement>(".ch-settings-tab.is-active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
		});

		const body = containerEl.createDiv({ cls: "ch-settings-body" });
		TABS.find((t) => t.id === OmniCalendarSettingTab.tab)?.render(this, body);
		if (scroller) scroller.scrollTop = keepScroll;
		// The sticky tab bar covers the area around it with the settings background, so rows
		// scrolled past it don't show above or beside it.
		const bg = backgroundOf(containerEl);
		if (bg) barWrap.style.setProperty("--ch-settings-bg", bg);
	}

	hide(): void {
		this.stopScroll?.();
		this.stopScroll = null;
	}
}

/** The element that scrolls the settings (the tab content itself, or an ancestor on mobile). */
function scrollParent(el: HTMLElement): HTMLElement | null {
	for (let e: HTMLElement | null = el; e; e = e.parentElement) {
		const o = getComputedStyle(e).overflowY;
		if (o === "auto" || o === "scroll") return e;
	}
	return null;
}

/** First non-transparent background colour of the element or its ancestors. */
function backgroundOf(el: HTMLElement): string | null {
	for (let e: HTMLElement | null = el; e; e = e.parentElement) {
		const c = getComputedStyle(e).backgroundColor;
		if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c;
	}
	return null;
}
