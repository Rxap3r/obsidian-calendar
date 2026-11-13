import { Modal, Notice, Platform, Setting } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { Account, AccountProvider } from "../types";
import { AuthSession } from "../sync/oauth";
import { PALETTE } from "../settings";

const GOOGLE_STEPS = [
	"Open console.cloud.google.com and create a project (any name).",
	"APIs & Services → Library → enable “Google Calendar API”.",
	"APIs & Services → OAuth consent screen (Google Auth Platform): choose “External”, fill in an app name and your e-mail. Under Audience add yourself as a test user, then click “Publish app” so sign-ins do not expire after 7 days.",
	"Clients (Credentials) → Create OAuth client → Application type “Desktop app” → Create.",
	"Copy the Client ID and Client secret into the fields below.",
];

const MS_STEPS = [
	"Open portal.azure.com (or entra.microsoft.com) → App registrations → New registration.",
	"Name: anything. Supported account types: “Accounts in any organizational directory and personal Microsoft accounts” (or “Personal Microsoft accounts only” for outlook.com).",
	"Redirect URI: platform “Public client/native (mobile & desktop)”, value http://localhost → Register.",
	"API permissions → Add → Microsoft Graph → Delegated → Calendars.ReadWrite (offline_access is added automatically).",
	"Copy the “Application (client) ID” from the Overview page into the field below. No client secret is needed.",
];

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
		this.tenant = existing?.tenant ?? "common";
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

		const help = contentEl.createEl("details", { cls: "ch-provider-help" });
		help.open = !this.existing;
		help.createEl("summary", { text: `One-time setup: create your ${this.name} app (≈10 minutes)` });
		const ol = help.createEl("ol");
		for (const step of this.provider === "google" ? GOOGLE_STEPS : MS_STEPS) ol.createEl("li", { text: step });

		new Setting(contentEl)
			.setName("Client ID")
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
			new Setting(contentEl)
				.setName("Account type")
				.setDesc("Must match “Supported account types” of your app registration. For a single company tenant, choose Other and enter its tenant ID.")
				.addDropdown((d) => {
					d.addOptions({
						common: "Work/school and personal",
						consumers: "Personal (outlook.com / hotmail)",
						organizations: "Work or school only",
						other: "Other (tenant ID)",
					});
					const known = ["common", "consumers", "organizations"].includes(this.tenant);
					d.setValue(known ? this.tenant : "other").onChange((v) => {
						if (v !== "other") this.tenant = v;
						tenantRow.settingEl.toggle(v === "other");
					});
				});
			const tenantRow = new Setting(contentEl).setName("Tenant ID").addText((t) =>
				t.setValue(["common", "consumers", "organizations"].includes(this.tenant) ? "" : this.tenant).onChange((v) => (this.tenant = v.trim()))
			);
			tenantRow.settingEl.toggle(!["common", "consumers", "organizations"].includes(this.tenant));
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
			if (!/^[a-z0-9.-]+$/i.test(this.tenant)) return "Invalid tenant ID.";
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
