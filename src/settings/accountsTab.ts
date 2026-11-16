import { Notice, Setting } from "obsidian";
import { Account } from "../types";
import { SignInModal } from "../modals/SignInModal";
import { confirmAction } from "../modals/ConfirmModal";
import { providerFor } from "../sync/providers";
import { errorMessage } from "../util";
import { info, SettingsContext, sourceControls } from "./controls";

/** Tab "Google & Outlook": connected accounts and their calendars. */
export function accountsTab(ctx: SettingsContext, el: HTMLElement) {
	const s = ctx.plugin.settings;
	const accounts = ctx.plugin.accounts;
	new Setting(el).setName("Google & Outlook accounts").setDesc("Show, create, edit, move and delete events directly from Obsidian.").setHeading();

	if (!accounts.secureStorageAvailable) {
		el.createDiv({
			cls: "ch-modal-hint ch-error",
			text: "Requires Obsidian 1.11.4 or newer (secure secret storage). Please update Obsidian to connect accounts.",
		});
	}
	methodGuide(el);
	info(el, "🔒 How is my account kept safe?", (box) => {
		box.createDiv({
			cls: "ch-provider",
			text: "No Omni Calendar server is involved – Obsidian talks directly to Google / Microsoft. You sign in on their own page in your browser, so the plugin never sees your password.",
		});
		box.createDiv({
			cls: "ch-provider",
			text: "Sign-in tokens are kept only in Obsidian's secure storage on this device (never in your vault or sync), so each device signs in separately. Only calendar access is requested – no e-mail, contacts or files.",
		});
	});

	for (const acc of s.accounts) accountBox(ctx, el, acc);
	if (!s.accounts.length) el.createDiv({ cls: "ch-empty", text: "No accounts connected yet." });
	new Setting(el)
		.addButton((b) =>
			b.setButtonText("Connect Google").setCta().setDisabled(!accounts.secureStorageAvailable).onClick(() =>
				new SignInModal(ctx.plugin, "google", null, () => ctx.redraw()).open()
			)
		)
		.addButton((b) =>
			b.setButtonText("Connect Outlook / Microsoft 365").setCta().setDisabled(!accounts.secureStorageAvailable).onClick(() =>
				new SignInModal(ctx.plugin, "outlook", null, () => ctx.redraw()).open()
			)
		);
}

/** Short overview of the connection methods and what each one needs. */
function methodGuide(el: HTMLElement) {
	const det = el.createEl("details", { cls: "ch-provider-help ch-info ch-method-guide" });
	det.createEl("summary", { text: "ℹ Which method should I use, and what do I need?" });
	const rows: [string, string, string][] = [
		["Local calendar", "Read & write in Obsidian only", "Nothing – works out of the box."],
		["ICS link (tab “Calendars”)", "Read-only · Google, Outlook, Proton, iCloud, …", "Only the calendar's private ICS link. 2 minutes, works on every device."],
		["Google account", "Read & write · Google Calendar", "Nothing – just sign in (built-in app). Google shows an “unverified app” warning for now; Workspace admins may block it. 1 minute."],
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
		text: "Tip: only want to see your events? Use an ICS link. Want to create or edit Google / Outlook events from Obsidian? Connect the account – no setup needed.",
	});
}

/** One connected account: sign-in state, actions, and its calendars. */
function accountBox(ctx: SettingsContext, el: HTMLElement, acc: Account) {
	const accounts = ctx.plugin.accounts;
	const box = el.createDiv({ cls: "ch-ics-box ch-account-box" });
	const signedIn = accounts.isSignedIn(acc);
	const needsReauth = accounts.needsReauth.has(acc.id);
	const providerName = providerFor(acc.provider).label;
	const head = new Setting(box)
		.setClass("ch-source-row")
		.setName(providerName)
		.setDesc(!signedIn ? "Not signed in on this device" : needsReauth ? "⚠ Access expired – sign in again" : "✓ Signed in on this device");
	if (!signedIn || needsReauth) head.descEl.addClass("ch-error");
	head.addText((t) => {
		t.setPlaceholder("Account name").setValue(acc.label).onChange(async (v) => {
			acc.label = v.trim() || acc.label;
			acc.customLabel = true;
			await ctx.save();
		});
		t.inputEl.setAttr("aria-label", "Account name (shown in the event dialog)");
	});

	head.addButton((b) =>
		b.setButtonText(signedIn && !needsReauth ? "Reconnect" : "Sign in").onClick(() =>
			new SignInModal(ctx.plugin, acc.provider, acc, () => ctx.redraw()).open()
		)
	);
	if (signedIn) {
		head.addExtraButton((b) =>
			b.setIcon("list-restart").setTooltip("Reload calendar list").onClick(async () => {
				try {
					const cals = await providerFor(acc.provider).listCalendars(accounts.tokenGetter(acc));
					accounts.syncCalendarList(acc, cals);
					await ctx.save(true);
				} catch (e) {
					new Notice(`Could not load calendars: ${errorMessage(e)}`);
				}
			})
		);
		head.addExtraButton((b) =>
			b.setIcon("log-out").setTooltip("Sign out on this device (revokes access)").onClick(async () => {
				await accounts.signOut(acc);
				for (const src of ctx.plugin.settings.sources) if (src.accountId === acc.id) ctx.plugin.store.forgetRemote(src.id);
				new Notice(acc.provider === "outlook"
					? "Signed out. To fully revoke access, also remove the app at account.microsoft.com → Privacy → Apps and services."
					: "Signed out and access revoked.");
				await ctx.save(true);
			})
		);
	}
	head.addExtraButton((b) =>
		b.setIcon("trash").setTooltip("Remove account").onClick(async () => {
			const ok = await confirmAction(ctx.app, "Remove account?", `Remove ${acc.label} and its calendars from Omni Calendar? Events in ${providerName} are not affected.`, "Remove");
			if (!ok) return;
			for (const src of ctx.plugin.settings.sources) if (src.accountId === acc.id) ctx.plugin.store.forgetRemote(src.id);
			await accounts.removeAccount(acc);
			await ctx.save(true);
		})
	);

	const cals = ctx.plugin.settings.sources.filter((x) => x.accountId === acc.id);
	for (const src of cals) {
		const status = ctx.plugin.store.status.get(src.id);
		let desc = src.readOnly ? "Read-only" : "Read & write";
		if (status?.loading) desc += " · loading…";
		else if (status?.error) desc += ` · ⚠ ${status.error}`;
		else if (status?.lastFetched) desc += ` · ${status.eventCount ?? 0} events`;
		const row = new Setting(box).setClass("ch-source-row").setClass("ch-account-cal").setDesc(desc);
		if (status?.error) row.descEl.addClass("ch-error");
		sourceControls(ctx, row, src, {
			toggleTip: "Show this calendar",
			afterToggle: (on) => (on ? ctx.plugin.store.refreshSource(src) : ctx.plugin.store.forgetRemote(src.id)),
		});
	}
}
