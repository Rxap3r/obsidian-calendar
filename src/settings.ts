import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type OmniCalendarPlugin from "./main";
import { Account, OmniCalendarSettings, CalendarSource, ViewMode } from "./types";
import { SignInModal } from "./modals/SignInModal";
import { confirmAction } from "./modals/ConfirmModal";
import { providerFor } from "./sync/providers";
import { uid } from "./dateUtils";
import { DEFAULT_NOTE_TEMPLATE } from "./notes";

export const PALETTE = ["#7c5cff", "#2f9e44", "#e8590c", "#1c7ed6", "#d6336c", "#f59f00", "#0ca678", "#ae3ec9", "#495057"];

export const DEFAULT_SETTINGS: OmniCalendarSettings = {
	firstDayOfWeek: 1,
	use24h: true,
	defaultView: "month",
	showWeekNumbers: false,
	scrollToHour: 7,
	defaultEventDuration: 60,
	refreshIntervalMinutes: 30,
	agendaDays: 30,
	sidebarUpcomingDays: 7,
	notesFolder: "Calendar",
	noteTemplate: DEFAULT_NOTE_TEMPLATE,
	defaultCalendarId: "personal",
	sources: [{ id: "personal", name: "Personal", color: PALETTE[0], type: "local", enabled: true }],
	accounts: [],
};

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

export class OmniCalendarSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: OmniCalendarPlugin) {
		super(app, plugin);
	}

	private async save(rerender = false) {
		await this.plugin.persist();
		this.plugin.store.notify();
		if (rerender) this.display();
	}

	display(): void {
		const { containerEl } = this;
		const s = this.plugin.settings;
		containerEl.empty();
		containerEl.addClass("ch-settings");

		// ---------------------------------------------------------------- General
		new Setting(containerEl).setName("General").setHeading();

		new Setting(containerEl).setName("First day of the week").addDropdown((d) => {
			["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].forEach((n, i) => d.addOption(String(i), n));
			d.setValue(String(s.firstDayOfWeek)).onChange(async (v) => {
				s.firstDayOfWeek = parseInt(v);
				await this.save();
			});
		});
		new Setting(containerEl).setName("24-hour clock").addToggle((t) =>
			t.setValue(s.use24h).onChange(async (v) => {
				s.use24h = v;
				await this.save();
			})
		);
		new Setting(containerEl).setName("Default view").setDesc("View used when the calendar page is opened.").addDropdown((d) =>
			d
				.addOptions({ month: "Month", week: "Week", day: "Day", agenda: "Agenda" })
				.setValue(s.defaultView)
				.onChange(async (v) => {
					s.defaultView = v as ViewMode;
					await this.save();
				})
		);
		new Setting(containerEl).setName("Show week numbers").addToggle((t) =>
			t.setValue(s.showWeekNumbers).onChange(async (v) => {
				s.showWeekNumbers = v;
				await this.save();
			})
		);
		this.numberSetting(containerEl, "Scroll to hour", "Week/day views start scrolled to this hour (0–23).", s.scrollToHour, 0, 23, (v) => (s.scrollToHour = v));
		this.numberSetting(containerEl, "Default event duration (minutes)", "", s.defaultEventDuration, 5, 1440, (v) => (s.defaultEventDuration = v));
		this.numberSetting(containerEl, "Agenda length (days)", "", s.agendaDays, 1, 365, (v) => (s.agendaDays = v));
		this.numberSetting(containerEl, "Sidebar: upcoming days", "How many days of upcoming events the sidebar calendar lists (0 hides the list).", s.sidebarUpcomingDays, 0, 60, (v) => (s.sidebarUpcomingDays = v));

		// ---------------------------------------------------------------- Notes
		new Setting(containerEl).setName("Event notes").setHeading();
		new Setting(containerEl)
			.setName("Notes folder")
			.setDesc("Where “Create note” puts notes for events.")
			.addText((t) =>
				t.setPlaceholder("Calendar").setValue(s.notesFolder).onChange(async (v) => {
					s.notesFolder = v.trim();
					await this.save();
				})
			);
		new Setting(containerEl)
			.setName("Note template")
			.setDesc("Placeholders: {{title}} {{date}} {{start}} {{end}} {{when}} {{location}} {{calendar}} {{description}}")
			.setClass("ch-template-setting")
			.addTextArea((t) => {
				t.setValue(s.noteTemplate).onChange(async (v) => {
					s.noteTemplate = v;
					await this.save();
				});
				t.inputEl.rows = 10;
			})
			.addExtraButton((b) =>
				b.setIcon("rotate-ccw").setTooltip("Reset to default").onClick(async () => {
					s.noteTemplate = DEFAULT_NOTE_TEMPLATE;
					await this.save(true);
				})
			);

		// ---------------------------------------------------------------- Local calendars
		new Setting(containerEl)
			.setName("Local calendars")
			.setDesc("Events in these calendars are created in Obsidian and stored in this vault (plugin data).")
			.setHeading();

		for (const src of s.sources.filter((x) => x.type === "local")) this.localRow(containerEl, src);
		new Setting(containerEl).addButton((b) =>
			b.setButtonText("Add local calendar").onClick(async () => {
				s.sources.push({ id: uid(), name: "New calendar", color: this.nextColor(), type: "local", enabled: true });
				await this.save(true);
			})
		);

		// ---------------------------------------------------------------- Accounts (two-way)
		new Setting(containerEl)
			.setName("Google & Outlook accounts (two-way)")
			.setDesc("Connect an account to show its calendars and create, edit, move and delete events directly from Obsidian.")
			.setHeading();

		this.methodGuide(containerEl);

		const accounts = this.plugin.accounts;
		if (!accounts.secureStorageAvailable) {
			containerEl.createDiv({
				cls: "ch-modal-hint ch-error",
				text: "Requires Obsidian 1.11.4 or newer (secure secret storage). Please update Obsidian to connect accounts.",
			});
		} else {
			containerEl.createDiv({
				cls: "ch-modal-hint",
				text: "🔒 No Omni Calendar server is involved – Obsidian talks directly to Google / Microsoft. Microsoft: just sign in. Google: uses your own app registration. Sign-in tokens are kept only in Obsidian's secure storage on this device (never in your vault or sync), so each device signs in separately.",
			});
		}
		for (const acc of s.accounts) this.accountBox(containerEl, acc);
		new Setting(containerEl)
			.addButton((b) =>
				b.setButtonText("Connect Google account").setDisabled(!accounts.secureStorageAvailable).onClick(() =>
					new SignInModal(this.plugin, "google", null, () => this.display()).open()
				)
			)
			.addButton((b) =>
				b.setButtonText("Connect Outlook / Microsoft 365").setDisabled(!accounts.secureStorageAvailable).onClick(() =>
					new SignInModal(this.plugin, "outlook", null, () => this.display()).open()
				)
			);

		// ---------------------------------------------------------------- External calendars
		new Setting(containerEl)
			.setName("External calendars (read-only)")
			.setDesc("Subscribe to Google, Outlook, Proton, iCloud or any other calendar that offers an ICS / iCal link. A vault path to an .ics file also works.")
			.setHeading();

		const help = containerEl.createEl("details", { cls: "ch-provider-help" });
		help.createEl("summary", { text: "How do I get the ICS link?" });
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

		for (const src of s.sources.filter((x) => x.type === "ics")) this.icsRow(containerEl, src);

		new Setting(containerEl)
			.addButton((b) =>
				b.setButtonText("Add external calendar").setCta().onClick(async () => {
					s.sources.push({ id: uid(), name: "External calendar", color: this.nextColor(), type: "ics", enabled: true, url: "" });
					await this.save(true);
				})
			)
			.addButton((b) =>
				b.setButtonText("Refresh all").onClick(async () => {
					await this.plugin.store.refreshAll();
					this.display();
				})
			);

		this.numberSetting(
			containerEl, "Refresh interval (minutes)", "How often external calendars are re-downloaded (0 = only on start-up / manually).",
			s.refreshIntervalMinutes, 0, 1440, (v) => {
				s.refreshIntervalMinutes = v;
				this.plugin.scheduleRefresh();
			}
		);
	}

	/** Short overview of the connection methods and what each one needs. */
	private methodGuide(el: HTMLElement) {
		const det = el.createEl("details", { cls: "ch-provider-help ch-method-guide" });
		det.createEl("summary", { text: "Which method should I use, and what do I need?" });
		const rows: [string, string, string][] = [
			["Local calendar", "Read & write in Obsidian only", "Nothing – works out of the box."],
			["ICS link (below)", "Read-only · Google, Outlook, Proton, iCloud, …", "Only the calendar's private ICS link. 2 minutes, works on every device."],
			["Google account", "Read & write · Google Calendar", "A Google account and a free Google Cloud project (no credit card). ≈10–15 minutes, once."],
			["Microsoft account", "Read & write · Outlook.com, Hotmail, Live, Microsoft 365", "Nothing – just sign in (built-in app). Work/school accounts may need approval from IT. 1 minute."],
			["Proton Calendar", "Read-only (ICS link)", "Proton offers no write access for apps. Export local events to .ics and import them in Proton if needed."],
		];
		const table = det.createEl("table", { cls: "ch-method-table" });
		const head = table.createEl("tr");
		for (const h of ["Method", "Can do", "What you need"]) head.createEl("th", { text: h });
		for (const r of rows) {
			const tr = table.createEl("tr");
			for (const c of r) tr.createEl("td", { text: c });
		}
		det.createDiv({
			cls: "ch-provider",
			text: "Tip: only want to see your events? Use an ICS link. Want to create or edit Google / Outlook events from Obsidian? Connect the account – Microsoft needs no setup; for Google the sign-in dialog shows the steps.",
		});
	}

	private nextColor(): string {
		const used = new Set(this.plugin.settings.sources.map((x) => x.color));
		return PALETTE.find((c) => !used.has(c)) ?? PALETTE[Math.floor(Math.random() * PALETTE.length)];
	}

	private numberSetting(el: HTMLElement, name: string, desc: string, value: number, min: number, max: number, set: (v: number) => void) {
		new Setting(el)
			.setName(name)
			.setDesc(desc)
			.addText((t) => {
				t.inputEl.type = "number";
				t.inputEl.min = String(min);
				t.inputEl.max = String(max);
				t.setValue(String(value)).onChange(async (v) => {
					const n = parseInt(v);
					if (isNaN(n)) return;
					set(Math.max(min, Math.min(max, n)));
					await this.save();
				});
			});
	}

	private localRow(el: HTMLElement, src: CalendarSource) {
		const s = this.plugin.settings;
		const count = this.plugin.data.events.filter((e) => e.calendarId === src.id).length;
		const row = new Setting(el).setClass("ch-source-row").setDesc(`${count} event${count === 1 ? "" : "s"}${s.defaultCalendarId === src.id ? " · default" : ""}`);
		row.addColorPicker((c) =>
			c.setValue(src.color).onChange(async (v) => {
				src.color = v;
				await this.save();
			})
		);
		row.addText((t) =>
			t.setValue(src.name).onChange(async (v) => {
				src.name = v || "Untitled";
				await this.save();
			})
		);
		row.addToggle((t) =>
			t.setTooltip("Visible").setValue(src.enabled).onChange(async (v) => {
				src.enabled = v;
				await this.save();
			})
		);
		if (s.defaultCalendarId !== src.id) {
			row.addExtraButton((b) =>
				b.setIcon("star").setTooltip("Make default for new events").onClick(async () => {
					s.defaultCalendarId = src.id;
					await this.save(true);
				})
			);
		}
		row.addExtraButton((b) =>
			b.setIcon("trash").setTooltip("Delete calendar and its events").onClick(async () => {
				const locals = s.sources.filter((x) => x.type === "local");
				if (locals.length <= 1) {
					new Notice("You need at least one local calendar.");
					return;
				}
				if (count > 0 && !window.confirm(`Delete "${src.name}" and its ${count} event(s)? This cannot be undone.`)) return;
				s.sources = s.sources.filter((x) => x.id !== src.id);
				this.plugin.data.events = this.plugin.data.events.filter((e) => e.calendarId !== src.id);
				if (s.defaultCalendarId === src.id) s.defaultCalendarId = s.sources.find((x) => x.type === "local")?.id ?? "";
				await this.save(true);
			})
		);
	}

	private accountBox(el: HTMLElement, acc: Account) {
		const accounts = this.plugin.accounts;
		const box = el.createDiv({ cls: "ch-ics-box ch-account-box" });
		const signedIn = accounts.isSignedIn(acc);
		const needsReauth = accounts.needsReauth.has(acc.id);
		const providerName = providerFor(acc.provider).label;
		const head = new Setting(box)
			.setClass("ch-source-row")
			.setName(`${providerName}: ${acc.label}`)
			.setDesc(!signedIn ? "Not signed in on this device" : needsReauth ? "⚠ Access expired – sign in again" : "✓ Signed in on this device");
		if (!signedIn || needsReauth) head.descEl.addClass("ch-error");

		head.addButton((b) =>
			b.setButtonText(signedIn && !needsReauth ? "Reconnect" : "Sign in").onClick(() =>
				new SignInModal(this.plugin, acc.provider, acc, () => this.display()).open()
			)
		);
		if (signedIn) {
			head.addExtraButton((b) =>
				b.setIcon("list-restart").setTooltip("Reload calendar list").onClick(async () => {
					try {
						const cals = await providerFor(acc.provider).listCalendars(accounts.tokenGetter(acc));
						accounts.syncCalendarList(acc, cals, PALETTE);
						await this.save(true);
					} catch (e) {
						new Notice(`Could not load calendars: ${e instanceof Error ? e.message : String(e)}`);
					}
				})
			);
			head.addExtraButton((b) =>
				b.setIcon("log-out").setTooltip("Sign out on this device (revokes access)").onClick(async () => {
					await accounts.signOut(acc);
					for (const src of this.plugin.settings.sources) if (src.accountId === acc.id) this.plugin.store.forgetRemote(src.id);
					new Notice(acc.provider === "outlook"
						? "Signed out. To fully revoke access, also remove the app at account.microsoft.com → Privacy → Apps and services."
						: "Signed out and access revoked.");
					await this.save(true);
				})
			);
		}
		head.addExtraButton((b) =>
			b.setIcon("trash").setTooltip("Remove account").onClick(async () => {
				const ok = await confirmAction(this.app, "Remove account?", `Remove ${acc.label} and its calendars from Omni Calendar? Events in ${providerName} are not affected.`, "Remove");
				if (!ok) return;
				for (const src of this.plugin.settings.sources) if (src.accountId === acc.id) this.plugin.store.forgetRemote(src.id);
				await accounts.removeAccount(acc);
				await this.save(true);
			})
		);

		const cals = this.plugin.settings.sources.filter((x) => x.accountId === acc.id);
		for (const src of cals) {
			const status = this.plugin.store.status.get(src.id);
			let desc = src.readOnly ? "Read-only" : "Read & write";
			if (status?.loading) desc += " · loading…";
			else if (status?.error) desc += ` · ⚠ ${status.error}`;
			else if (status?.lastFetched) desc += ` · ${status.eventCount ?? 0} events`;
			const row = new Setting(box).setClass("ch-source-row").setClass("ch-account-cal").setDesc(desc);
			if (status?.error) row.descEl.addClass("ch-error");
			row.addColorPicker((c) =>
				c.setValue(src.color).onChange(async (v) => {
					src.color = v;
					await this.save();
				})
			);
			row.addText((t) =>
				t.setValue(src.name).onChange(async (v) => {
					src.name = v || "Untitled";
					await this.save();
				})
			);
			row.addToggle((t) =>
				t.setTooltip("Show this calendar").setValue(src.enabled).onChange(async (v) => {
					src.enabled = v;
					await this.save();
					if (v) await this.plugin.store.refreshSource(src);
					else this.plugin.store.forgetRemote(src.id);
				})
			);
		}
	}

	private icsRow(el: HTMLElement, src: CalendarSource) {
		const s = this.plugin.settings;
		const box = el.createDiv({ cls: "ch-ics-box" });
		const status = this.plugin.store.status.get(src.id);
		let desc = "Not loaded yet";
		if (status?.loading) desc = "Loading…";
		else if (status?.error) desc = `⚠ ${status.error}`;
		else if (status?.lastFetched) desc = `✓ ${status.eventCount ?? 0} events · updated ${new Date(status.lastFetched).toLocaleTimeString()}`;
		else if (status?.eventCount !== undefined) desc = `${status.eventCount} events (cached)`;

		const top = new Setting(box).setClass("ch-source-row").setDesc(desc);
		if (status?.error) top.descEl.addClass("ch-error");
		top.addColorPicker((c) =>
			c.setValue(src.color).onChange(async (v) => {
				src.color = v;
				await this.save();
			})
		);
		top.addText((t) =>
			t.setPlaceholder("Name").setValue(src.name).onChange(async (v) => {
				src.name = v || "Untitled";
				await this.save();
			})
		);
		top.addToggle((t) =>
			t.setTooltip("Enabled").setValue(src.enabled).onChange(async (v) => {
				src.enabled = v;
				await this.save();
				if (v) await this.plugin.store.refreshSource(src);
			})
		);
		top.addExtraButton((b) =>
			b.setIcon("refresh-cw").setTooltip("Refresh now").onClick(async () => {
				await this.plugin.store.refreshSource(src);
				this.display();
			})
		);
		top.addExtraButton((b) =>
			b.setIcon("trash").setTooltip("Remove").onClick(async () => {
				s.sources = s.sources.filter((x) => x.id !== src.id);
				await this.plugin.store.removeCache(src.id);
				await this.save(true);
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
						await this.plugin.persist();
					});
				t.inputEl.addEventListener("blur", async () => {
					if (src.url) {
						await this.plugin.store.refreshSource(src);
						this.display();
					}
				});
			});
	}
}
