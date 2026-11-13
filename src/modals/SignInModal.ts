import { Modal, Notice, Platform, Setting } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { Account, AccountProvider } from "../types";
import { AuthSession } from "../sync/oauth";
import { PALETTE } from "../settings";

interface SetupGuide {
	title: string;
	needs: string[];
	steps: string[];
	problems: string[];
}

const GOOGLE_GUIDE: SetupGuide = {
	title: "One-time setup: your own Google app (≈10–15 minutes, free)",
	needs: [
		"A Google account (personal Gmail works; Google Workspace only if your admin allows self-made apps).",
		"A free Google Cloud project – no credit card or billing account needed.",
		"A desktop computer for this setup (signing in later also works on mobile).",
	],
	steps: [
		"Open console.cloud.google.com → project picker → New project (any name).",
		"APIs & Services → Library → search “Google Calendar API” → Enable.",
		"Google Auth Platform (OAuth consent screen) → Get started: app name of your choice, your e-mail, Audience “External”.",
		"Audience → “Publish app” (In production). Without this Google signs you out every 7 days. No verification needed.",
		"Clients → Create client → Application type “Desktop app” → Create.",
		"Copy the Client ID (….apps.googleusercontent.com) and Client secret (GOCSPX-…) into the fields below and click “Sign in with Google”.",
		"Google will warn “Google hasn’t verified this app” – expected, because it is your own app: click Advanced → Go to (your app) → Allow.",
	],
	problems: [
		"“Access blocked / has not completed verification” → publish the app (step 4).",
		"Signed out after a week → the app is still in Testing; publish it.",
		"“org_internal” or blocked by admin → your Workspace admin does not allow it; use an ICS link instead.",
	],
};

const MS_WORK_GUIDE: SetupGuide = {
	title: "One-time setup: Microsoft app for a work/school account (≈10 minutes, free)",
	needs: [
		"A work or school Microsoft 365 account.",
		"Permission to register apps in your organisation (usually allowed; otherwise ask IT to create it with the steps below).",
		"No client secret and no cost.",
	],
	steps: [
		"Open entra.microsoft.com (or portal.azure.com) with your work account → App registrations → New registration.",
		"Name: anything. Supported account types: “Accounts in this organizational directory only” or “Accounts in any organizational directory”.",
		"Redirect URI: platform “Public client/native (mobile & desktop)”, value http://localhost → Register.",
		"API permissions → Add a permission → Microsoft Graph → Delegated → Calendars.ReadWrite → Add permissions.",
		"Overview → copy the Application (client) ID into the field below. For a single-organisation app choose “Single organisation” above and also copy the Directory (tenant) ID.",
	],
	problems: [
		"“Need admin approval” → ask IT to “Grant admin consent” for Calendars.ReadWrite on your app.",
		"AADSTS50194 “not configured as multi-tenant” → choose “Single organisation” and enter the tenant ID.",
	],
};

const MS_PERSONAL_GUIDE: SetupGuide = {
	title: "One-time setup: Microsoft app for a personal account (≈20–30 minutes, free)",
	needs: [
		"Your Outlook.com / Hotmail / Live account.",
		"A free Azure account (azure.microsoft.com/free). Microsoft only allows app registrations inside a “directory”, and personal accounts get one through this sign-up. Microsoft asks for a phone number and a credit card to verify your identity; the app registration itself costs nothing.",
		"A desktop computer for this setup.",
	],
	steps: [
		"Sign up at azure.microsoft.com/free with your Outlook.com account (skip if you already have Azure).",
		"Open portal.azure.com → search “App registrations” → New registration.",
		"Name: anything. Supported account types: “Personal Microsoft accounts only” (or “… organizational directory and personal Microsoft accounts”).",
		"Redirect URI: platform “Public client/native (mobile & desktop)”, value http://localhost → Register.",
		"API permissions → Add a permission → Microsoft Graph → Delegated → Calendars.ReadWrite → Add permissions.",
		"Overview → copy the Application (client) ID into the field below and click “Sign in with Microsoft”.",
	],
	problems: [
		"No directory / cannot create app registrations → finish the Azure sign-up (step 1).",
		"AADSTS50020 “account does not exist in tenant” → the app does not allow personal accounts; change Supported account types under Authentication.",
		"“unauthorized_client” → the redirect URI must be platform “Public client/native” with value exactly http://localhost.",
	],
};

const TENANT_OPTIONS: Record<string, string> = {
	consumers: "Personal – Outlook.com, Hotmail, Live",
	organizations: "Work or school – Microsoft 365",
	other: "Work or school – single organisation (tenant ID)",
	common: "Both personal and work/school",
};

/** Connect (or reconnect) a Google / Microsoft account. */
export class SignInModal extends Modal {
	private session: AuthSession | null = null;
	private clientId: string;
	private clientSecret = "";
	private tenant: string;
	private statusEl!: HTMLElement;
	private manualEl!: HTMLElement;
	private signInBtn!: HTMLButtonElement;

	constructor(
		private plugin: OmniCalendarPlugin,
		private provider: AccountProvider,
		private existing: Account | null,
		private onDone: () => void
	) {
		super(plugin.app);
		this.clientId = existing?.clientId ?? "";
		this.tenant = existing?.tenant ?? "consumers";
	}

	private get name() {
		return this.provider === "google" ? "Google" : "Microsoft";
	}

	onOpen() {
		const { contentEl } = this;
		const accounts = this.plugin.accounts;
		this.modalEl.addClass("ch-signin-modal");
		this.setTitle(`${this.existing ? "Reconnect" : "Connect"} ${this.name} account`);

		if (!accounts.secureStorageAvailable) {
			contentEl.createDiv({
				cls: "ch-modal-hint ch-error",
				text: "Your Obsidian version has no secure secret storage. Please update Obsidian to 1.11.4 or newer – Omni Calendar will not store sign-in tokens anywhere else.",
			});
			return;
		}

		const intro = contentEl.createDiv({ cls: "ch-modal-hint" });
		intro.appendText(
			`You connect with your own ${this.name} app registration, so no third party is involved: Obsidian talks directly to ${this.name}. ` +
				"Sign-in happens in your browser – Omni Calendar never sees your password. The access token is stored only on this device in Obsidian's secure storage, never in your vault."
		);

		const isKnownTenant = (t: string) => ["common", "consumers", "organizations"].includes(t);
		let tenantRow: Setting | null = null;
		if (this.provider === "outlook") {
			new Setting(contentEl)
				.setName("Which Microsoft account?")
				.setDesc("Choose the kind of account you want to connect. This changes the setup steps below and must match “Supported account types” in your app registration.")
				.addDropdown((d) => {
					d.addOptions(TENANT_OPTIONS);
					d.setValue(isKnownTenant(this.tenant) ? this.tenant : "other").onChange((v) => {
						if (v !== "other") this.tenant = v;
						else if (isKnownTenant(this.tenant)) this.tenant = "";
						tenantRow?.settingEl.toggle(v === "other");
						renderGuide();
					});
				});
		}

		const guideEl = contentEl.createDiv();
		const renderGuide = () => {
			guideEl.empty();
			const guide =
				this.provider === "google"
					? GOOGLE_GUIDE
					: this.tenant === "consumers" || this.tenant === "common"
						? MS_PERSONAL_GUIDE
						: MS_WORK_GUIDE;
			const det = guideEl.createEl("details", { cls: "ch-provider-help ch-setup-guide" });
			det.open = !this.existing;
			det.createEl("summary", { text: guide.title });
			det.createEl("div", { cls: "ch-guide-label", text: "What you need" });
			const needs = det.createEl("ul");
			for (const n of guide.needs) needs.createEl("li", { text: n });
			det.createEl("div", { cls: "ch-guide-label", text: "Steps" });
			const ol = det.createEl("ol");
			for (const st of guide.steps) ol.createEl("li", { text: st });
			det.createEl("div", { cls: "ch-guide-label", text: "If something goes wrong" });
			const pr = det.createEl("ul");
			for (const p of guide.problems) pr.createEl("li", { text: p });
			det.createEl("div", {
				cls: "ch-muted",
				text: "Only want to see events, not edit them? An ICS link (External calendars below) needs no setup at all.",
			});
		};
		renderGuide();

		new Setting(contentEl)
			.setName(this.provider === "google" ? "Client ID" : "Application (client) ID")
			.addText((t) => {
				t.setPlaceholder(this.provider === "google" ? "….apps.googleusercontent.com" : "00000000-0000-0000-0000-000000000000")
					.setValue(this.clientId)
					.onChange((v) => (this.clientId = v.trim()));
				t.inputEl.addClass("ch-wide-input");
				t.inputEl.autocomplete = "off";
				t.inputEl.spellcheck = false;
			});

		if (this.provider === "google") {
			const hasSecret = this.existing ? accounts.hasClientSecret(this.existing) : false;
			new Setting(contentEl)
				.setName("Client secret")
				.setDesc(hasSecret ? "Stored securely on this device. Leave empty to keep it." : "Stored only in Obsidian's secure storage on this device.")
				.addText((t) => {
					t.inputEl.type = "password";
					t.inputEl.autocomplete = "off";
					t.inputEl.addClass("ch-wide-input");
					t.setPlaceholder(hasSecret ? "••••••••" : "GOCSPX-…").onChange((v) => (this.clientSecret = v.trim()));
				});
		} else {
			tenantRow = new Setting(contentEl)
				.setName("Directory (tenant) ID")
				.setDesc("From the Overview page of your app registration.")
				.addText((t) =>
					t.setPlaceholder("00000000-0000-0000-0000-000000000000").setValue(isKnownTenant(this.tenant) ? "" : this.tenant).onChange((v) => (this.tenant = v.trim()))
				);
			tenantRow.settingEl.toggle(!isKnownTenant(this.tenant));
		}

		const actions = new Setting(contentEl).setClass("ch-modal-buttons");
		actions.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
		actions.addButton((b) => {
			b.setButtonText(`Sign in with ${this.name}`).setCta().onClick(() => void this.signIn());
			this.signInBtn = b.buttonEl;
		});

		this.statusEl = contentEl.createDiv({ cls: "ch-signin-status" });

		this.manualEl = contentEl.createDiv({ cls: "ch-signin-manual" });
		this.manualEl.hide();
	}

	private validate(): string | null {
		if (!this.clientId) return "Enter the Client ID.";
		if (this.provider === "google") {
			if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(this.clientId)) return "The Google Client ID should end with .apps.googleusercontent.com";
			const hasSecret = this.existing ? this.plugin.accounts.hasClientSecret(this.existing) : false;
			if (!this.clientSecret && !hasSecret) return "Enter the Client secret.";
		} else {
			if (!/^[0-9a-f-]{36}$/i.test(this.clientId)) return "The Application (client) ID should look like 00000000-0000-0000-0000-000000000000";
			if (!/^[a-z0-9.-]+$/i.test(this.tenant)) return "Enter a valid Directory (tenant) ID.";
		}
		return null;
	}

	private async signIn() {
		const err = this.validate();
		if (err) {
			new Notice(err);
			return;
		}
		const accounts = this.plugin.accounts;
		const isNew = !this.existing;
		const account: Account = this.existing ?? accounts.newAccount(this.provider, this.clientId, this.provider === "outlook" ? this.tenant : undefined);
		account.clientId = this.clientId;
		if (this.provider === "outlook") account.tenant = this.tenant;

		this.session?.cancel();
		this.signInBtn.disabled = true;
		try {
			if (this.clientSecret) accounts.setClientSecret(account, this.clientSecret);
			const session = await accounts.beginSignIn(account);
			this.session = session;
			this.showWaiting(session);
			window.open(session.authUrl);
			const calendars = await accounts.completeSignIn(account, session);
			if (isNew) this.plugin.settings.accounts.push(account);
			accounts.syncCalendarList(account, calendars, PALETTE);
			await this.plugin.persist();
			this.plugin.store.notify();
			new Notice(`Connected ${account.label}. Choose which calendars to show in settings.`);
			void this.plugin.store.refreshAll();
			this.onDone();
			this.close();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (!/cancelled/i.test(msg)) {
				this.statusEl.setText(`❌ ${msg}`);
				this.statusEl.addClass("ch-error");
			}
			// A failed first sign-in must not leave secrets behind.
			if (isNew) await accounts.removeAccount(account).catch(() => undefined);
		} finally {
			this.signInBtn.disabled = false;
		}
	}

	private showWaiting(session: AuthSession) {
		this.statusEl.removeClass("ch-error");
		this.statusEl.setText(`⏳ Waiting for you to finish signing in in your browser…`);
		this.manualEl.empty();
		this.manualEl.show();
		const det = this.manualEl.createEl("details");
		det.open = !session.automatic || Platform.isMobile;
		det.createEl("summary", { text: session.automatic ? "Browser did not return to Obsidian?" : "Finish sign-in" });
		det.createEl("p", {
			text:
				"After you approve access, the browser opens an address starting with " +
				`${session.redirectUri} and may show “can't connect” – that is expected. Copy that full address from the address bar and paste it here:`,
		});
		const row = det.createDiv({ cls: "ch-signin-paste" });
		const input = row.createEl("input", { type: "text", cls: "ch-wide-input", attr: { placeholder: `${session.redirectUri}/?state=…&code=…` } });
		input.autocomplete = "off";
		input.spellcheck = false;
		const btn = row.createEl("button", { text: "Continue", cls: "mod-cta" });
		btn.onclick = () => {
			try {
				session.submitRedirectUrl(input.value);
				input.value = "";
			} catch (e) {
				new Notice(e instanceof Error ? e.message : String(e));
			}
		};
		const again = det.createEl("button", { text: "Open sign-in page again" });
		again.onclick = () => window.open(session.authUrl);
	}

	onClose() {
		this.session?.cancel();
		this.session = null;
		this.contentEl.empty();
	}
}
