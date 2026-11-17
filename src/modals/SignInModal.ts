import { Modal, Notice, Platform, Setting } from "obsidian";
import type OmniCalendarPlugin from "../main";
import { Account, AccountProvider } from "../types";
import { AuthSession } from "../sync/oauth";
import { GOOGLE_GUIDE, GOOGLE_QUICK_NOTES, MS_PERSONAL_GUIDE, MS_QUICK_NOTES, MS_WORK_GUIDE, TENANT_OPTIONS } from "../sync/setupGuides";
import { BUILTIN_GOOGLE_CLIENT_ID, BUILTIN_MICROSOFT_CLIENT_ID, BUILTIN_MICROSOFT_TENANT, hasBuiltinGoogleClient, isBuiltinClient } from "../sync/builtin";
import { errorMessage } from "../util";

/** Connect (or reconnect) a Google / Microsoft account. */
export class SignInModal extends Modal {
	private session: AuthSession | null = null;
	private clientId: string;
	private clientSecret = "";
	private tenant: string;
	/** Microsoft only: use the built-in Omni Calendar app registration. */
	private useBuiltin: boolean;
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
		const builtinAvailable = provider === "outlook" || hasBuiltinGoogleClient();
		this.useBuiltin = builtinAvailable && (!existing || isBuiltinClient(provider, existing.clientId));
		if (this.useBuiltin && existing) {
			this.clientId = "";
			this.tenant = "consumers";
		}
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
		if (this.provider === "outlook" || hasBuiltinGoogleClient()) {
			new Setting(contentEl)
				.setName("How do you want to connect?")
				.addDropdown((d) =>
					d
						.addOptions({ builtin: "Quick sign-in (recommended)", own: "Use my own app registration (advanced)" })
						.setValue(this.useBuiltin ? "builtin" : "own")
						.onChange((v) => {
							this.useBuiltin = v === "builtin";
							renderBody();
						})
				);
		}
		const body = contentEl.createDiv();
		const renderBody = () => {
			body.empty();
			intro.empty();
			if (this.provider === "google" && this.useBuiltin) {
				intro.appendText(
					"Sign in with your Google account. No setup needed. " +
						"Sign-in happens in your browser, so Omni Calendar never sees your password. The access token is stored only on this device in Obsidian's secure storage, never in your vault, and no Omni Calendar server is involved."
				);
				const det = body.createEl("details", { cls: "ch-provider-help ch-setup-guide" });
				det.open = true;
				det.createEl("summary", { text: "What will I see when signing in?" });
				const ul = det.createEl("ul");
				for (const t of GOOGLE_QUICK_NOTES) ul.createEl("li", { text: t });
				return;
			}
			if (this.provider === "outlook" && this.useBuiltin) {
				intro.appendText(
					"Sign in with your Microsoft account – personal (Outlook.com, Hotmail, Live) or work/school. No setup needed. " +
						"Sign-in happens in your browser, so Omni Calendar never sees your password. The access token is stored only on this device in Obsidian's secure storage, never in your vault, and no Omni Calendar server is involved."
				);
				const det = body.createEl("details", { cls: "ch-provider-help ch-setup-guide" });
				det.createEl("summary", { text: "What will I see when signing in?" });
				const ul = det.createEl("ul");
				for (const t of MS_QUICK_NOTES) ul.createEl("li", { text: t });
				return;
			}
			intro.appendText(
				`You connect with your own ${this.name} app registration, so no third party is involved: Obsidian talks directly to ${this.name}. ` +
					"Sign-in happens in your browser – Omni Calendar never sees your password. The access token is stored only on this device in Obsidian's secure storage, never in your vault."
			);
			const isKnownTenant = (t: string) => ["common", "consumers", "organizations"].includes(t);
			let tenantRow: Setting | null = null;
			if (this.provider === "outlook") {
				new Setting(body)
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

			const guideEl = body.createDiv();
			// Which Microsoft sign-in page will open – easy to miss that "Personal" is preselected.
			const pageHint = this.provider === "outlook" ? body.createDiv({ cls: "ch-modal-hint ch-signin-page-hint" }) : null;
			const renderGuide = () => {
				guideEl.empty();
				pageHint?.setText(
					this.tenant === "consumers"
						? "You'll sign in on Microsoft's page for personal accounts (Outlook.com, Hotmail, Live). Using a company or school account? Change “Which Microsoft account?” above."
						: this.tenant === "common"
							? "Microsoft's sign-in page will accept both personal and company/school accounts."
							: "You'll sign in with a company or school account (Microsoft 365)."
				);
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
					text: "Only want to see events, not edit them? An ICS subscription (Settings → Calendars) needs no setup at all.",
				});
			};
			renderGuide();

			new Setting(body)
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
				new Setting(body)
					.setName("Client secret")
					.setDesc(hasSecret ? "Stored securely on this device. Leave empty to keep it." : "Stored only in Obsidian's secure storage on this device.")
					.addText((t) => {
						t.inputEl.type = "password";
						t.inputEl.autocomplete = "off";
						t.inputEl.addClass("ch-wide-input");
						t.setPlaceholder(hasSecret ? "••••••••" : "GOCSPX-…").onChange((v) => (this.clientSecret = v.trim()));
					});
			} else {
				tenantRow = new Setting(body)
					.setName("Directory (tenant) ID")
					.setDesc("From the Overview page of your app registration.")
					.addText((t) =>
						t.setPlaceholder("00000000-0000-0000-0000-000000000000").setValue(isKnownTenant(this.tenant) ? "" : this.tenant).onChange((v) => (this.tenant = v.trim()))
					);
				tenantRow.settingEl.toggle(!isKnownTenant(this.tenant));
			}
		};
		renderBody();

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
		if (this.useBuiltin) return null;
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
		const builtin = this.useBuiltin;
		const clientId = builtin ? (this.provider === "google" ? BUILTIN_GOOGLE_CLIENT_ID : BUILTIN_MICROSOFT_CLIENT_ID) : this.clientId;
		const tenant = builtin ? BUILTIN_MICROSOFT_TENANT : this.tenant;
		const account: Account = this.existing ?? accounts.newAccount(this.provider, clientId, this.provider === "outlook" ? tenant : undefined);
		account.clientId = clientId;
		if (this.provider === "outlook") account.tenant = tenant;

		this.session?.cancel();
		this.signInBtn.disabled = true;
		try {
			if (!builtin && this.clientSecret) accounts.setClientSecret(account, this.clientSecret);
			const session = await accounts.beginSignIn(account);
			this.session = session;
			this.showWaiting(session);
			window.open(session.authUrl);
			const calendars = await accounts.completeSignIn(account, session);
			if (isNew) this.plugin.settings.accounts.push(account);
			accounts.syncCalendarList(account, calendars);
			await this.plugin.persist();
			this.plugin.store.notify();
			new Notice(`Connected ${account.label}. Choose which calendars to show in settings.`);
			void this.plugin.store.refreshAll();
			this.onDone();
			this.close();
		} catch (e) {
			const msg = errorMessage(e);
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
				new Notice(errorMessage(e));
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
