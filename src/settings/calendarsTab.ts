import { Notice, Setting } from "obsidian";
import { CalendarSource } from "../types";
import { nextColor } from "../defaults";
import { confirmAction } from "../modals/ConfirmModal";
import { dateLang, uid } from "../dateUtils";
import { plural } from "../util";
import { info, numberSetting, SettingsContext, sourceControls } from "./controls";

const PROVIDER_HELP: { name: string; steps: string }[] = [
	{
		name: "Google Calendar",
		steps:
			"calendar.google.com → ⚙ Settings → select the calendar under “Settings for my calendars” → “Integrate calendar” → copy “Secret address in iCal format”. It looks like https://calendar.google.com/calendar/ical/…/private-…/basic.ics – the address in your browser bar will not work.",
	},
	{
		name: "Outlook / Microsoft 365",
		steps:
			"outlook.com or Outlook on the web → ⚙ Settings → Calendar → Shared calendars → “Publish a calendar” → choose calendar and “Can view all details” → Publish → copy the ICS link.",
	},
	{
		name: "Proton Calendar",
		steps:
			"calendar.proton.me → Settings → Calendars → select calendar → “Share” / “Share with anyone” → “Create link” (full view) → copy the link.",
	},
	{
		name: "Apple iCloud",
		steps: "Calendar app → right-click calendar → Share Calendar → “Public Calendar” → copy the webcal:// link.",
	},
];

/** Tab "Calendars": where new events go, local calendars, ICS subscriptions. */
export function calendarsTab(ctx: SettingsContext, el: HTMLElement) {
	const s = ctx.plugin.settings;

	new Setting(el).setName("New events").setDesc("Calendars new events are saved to by default. You can change it for each event.").setHeading();
	defaultTargetsSection(ctx, el);

	new Setting(el).setName("Local calendars").setDesc("Created in Obsidian, stored in this vault.").setHeading();
	for (const src of s.sources.filter((x) => x.type === "local")) localRow(ctx, el, src);
	new Setting(el).addButton((b) =>
		b.setButtonText("Add local calendar").onClick(async () => {
			s.sources.push({ id: uid(), name: "New calendar", color: nextColor(s.sources.map((x) => x.color), s.sources.length), type: "local", enabled: true });
			await ctx.save(true);
		})
	);

	new Setting(el).setName("Subscriptions (read-only)").setDesc("ICS links from Google, Outlook, Proton, iCloud … or an .ics file in your vault.").setHeading();
	info(el, "ℹ How do I get the ICS link?", (help) => {
		help.createDiv({
			cls: "ch-provider",
			text: "What you need: access to the calendar's settings on the provider's website. No sign-in or app setup; works on every device. Read-only, and some providers update the feed with a delay of minutes to a few hours.",
		});
		for (const p of PROVIDER_HELP) {
			const row = help.createDiv({ cls: "ch-provider" });
			row.createEl("strong", { text: p.name + ": " });
			row.appendText(p.steps);
		}
		help.createDiv({
			cls: "ch-provider ch-muted",
			text: "Treat these links like passwords – anyone with the link can read the calendar. They are stored in this vault's plugin data (.obsidian/plugins/omni-calendar/data.json).",
		});
	});
	for (const src of s.sources.filter((x) => x.type === "ics")) icsRow(ctx, el, src);
	new Setting(el)
		.addButton((b) =>
			b.setButtonText("Add subscription").setCta().onClick(async () => {
				s.sources.push({ id: uid(), name: "External calendar", color: nextColor(s.sources.map((x) => x.color), s.sources.length), type: "ics", enabled: true, url: "" });
				await ctx.save(true);
			})
		)
		.addButton((b) =>
			b.setButtonText("Refresh all").onClick(async () => {
				await ctx.plugin.store.refreshAll();
				ctx.redraw();
			})
		);
	numberSetting(
		ctx, el, "Refresh every (minutes)", "Re-download subscriptions and connected accounts. 0 = only at start-up or manually.",
		s.refreshIntervalMinutes, 0, 1440, (v) => {
			s.refreshIntervalMinutes = v;
			ctx.plugin.scheduleRefresh();
		}
	);
}

/** Toggle list of every calendar new events can be saved to. */
function defaultTargetsSection(ctx: SettingsContext, el: HTMLElement) {
	const s = ctx.plugin.settings;
	const store = ctx.plugin.store;
	const options = store.writableTargets();
	const chosen = new Set(store.defaultTargets().map((x) => x.id));
	for (const src of options) {
		const row = new Setting(el).setClass("ch-source-row").setName(src.name).setDesc(store.sourceKindLabel(src));
		const dot = row.nameEl.createSpan({ cls: "ch-dot" });
		dot.style.setProperty("--ch-event-color", src.color);
		row.nameEl.prepend(dot);
		row.addToggle((t) =>
			t.setTooltip("Save new events here").setValue(chosen.has(src.id)).onChange(async (v) => {
				const next = new Set(store.defaultTargets().map((x) => x.id));
				if (v) next.add(src.id);
				else next.delete(src.id);
				if (!next.size) {
					new Notice("At least one calendar is needed.");
					t.setValue(true);
					return;
				}
				s.defaultTargets = Array.from(next);
				const firstLocal = s.defaultTargets.find((id) => s.sources.some((x) => x.id === id && x.type === "local"));
				if (firstLocal) s.defaultCalendarId = firstLocal;
				await ctx.save();
			})
		);
	}
	const hint = el.createDiv({ cls: "ch-provider ch-muted ch-small-hint" });
	hint.setText(
		"Lists your local calendars and the Google / Outlook calendars that are switched on (tab “Google & Outlook”). " +
			"With several selected, each gets its own copy of the event."
	);
}

function localRow(ctx: SettingsContext, el: HTMLElement, src: CalendarSource) {
	const s = ctx.plugin.settings;
	const count = ctx.plugin.data.events.filter((e) => e.calendarId === src.id).length;
	const row = new Setting(el).setClass("ch-source-row").setDesc(`${plural(count, "event")}${s.defaultTargets.includes(src.id) ? " · default for new events" : ""}`);
	sourceControls(ctx, row, src, { toggleTip: "Visible" });
	row.addExtraButton((b) =>
		b.setIcon("trash").setTooltip("Delete calendar and its events").onClick(async () => {
			const locals = s.sources.filter((x) => x.type === "local");
			if (locals.length <= 1) {
				new Notice("You need at least one local calendar.");
				return;
			}
			if (count > 0 && !(await confirmAction(ctx.app, "Delete calendar", `Delete “${src.name}” and its ${plural(count, "event")}? This can't be undone.`))) return;
			s.sources = s.sources.filter((x) => x.id !== src.id);
			ctx.plugin.data.events = ctx.plugin.data.events.filter((e) => e.calendarId !== src.id);
			if (s.defaultCalendarId === src.id) s.defaultCalendarId = s.sources.find((x) => x.type === "local")?.id ?? "";
			s.defaultTargets = s.defaultTargets.filter((id) => id !== src.id);
			if (!s.defaultTargets.length) s.defaultTargets = [s.defaultCalendarId];
			await ctx.save(true);
		})
	);
}

function icsRow(ctx: SettingsContext, el: HTMLElement, src: CalendarSource) {
	const s = ctx.plugin.settings;
	const box = el.createDiv({ cls: "ch-ics-box" });
	const status = ctx.plugin.store.status.get(src.id);
	let desc = "Not loaded yet";
	if (status?.loading) desc = "Loading…";
	else if (status?.error) desc = `⚠ ${status.error}`;
	else if (status?.lastFetched) desc = `✓ ${status.eventCount ?? 0} events · updated ${new Date(status.lastFetched).toLocaleTimeString(dateLang())}`;
	else if (status?.eventCount !== undefined) desc = `${status.eventCount} events (cached)`;

	const top = new Setting(box).setClass("ch-source-row").setDesc(desc);
	if (status?.error) top.descEl.addClass("ch-error");
	sourceControls(ctx, top, src, {
		toggleTip: "Enabled",
		namePlaceholder: "Name",
		afterToggle: (on) => on && ctx.plugin.store.refreshSource(src),
	});
	top.addExtraButton((b) =>
		b.setIcon("refresh-cw").setTooltip("Refresh now").onClick(async () => {
			await ctx.plugin.store.refreshSource(src);
			ctx.redraw();
		})
	);
	top.addExtraButton((b) =>
		b.setIcon("trash").setTooltip("Remove").onClick(async () => {
			s.sources = s.sources.filter((x) => x.id !== src.id);
			await ctx.plugin.store.removeCache(src.id);
			await ctx.save(true);
		})
	);

	new Setting(box)
		.setClass("ch-url-row")
		.setName("ICS URL")
		.addText((t) => {
			t.setPlaceholder("https://… .ics  or  webcal://…  or  path/in/vault.ics")
				.setValue(src.url ?? "")
				.onChange(async (v) => {
					src.url = v.trim();
					await ctx.plugin.persist();
				});
			t.inputEl.addEventListener("blur", async () => {
				if (src.url) {
					await ctx.plugin.store.refreshSource(src);
					ctx.redraw();
				}
			});
		});
}
