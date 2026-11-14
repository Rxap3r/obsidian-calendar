import type OmniCalendarPlugin from "../main";
import { Account, AccountProvider, CalendarSource } from "../types";
import { uid } from "../dateUtils";
import { AuthSession, OAuthError, refreshAccessToken } from "./oauth";
import { providerFor, RemoteCalendarInfo } from "./providers";
import { TokenGetter } from "./http";

interface CachedToken {
	token: string;
	expiresAt: number;
}

/**
 * Manages connected Google / Microsoft accounts.
 *
 * Secrets (refresh token, Google client secret) are stored only in Obsidian's
 * SecretStorage – on this device, outside the vault, never synced and never in data.json.
 * Access tokens are kept in memory only and expire after about an hour.
 */
export class AccountManager {
	private tokens = new Map<string, CachedToken>();
	private refreshing = new Map<string, Promise<string>>();
	/** Accounts whose refresh token was rejected (user must sign in again). */
	readonly needsReauth = new Set<string>();

	constructor(private plugin: OmniCalendarPlugin) {}

	get accounts(): Account[] {
		return this.plugin.settings.accounts;
	}

	getAccount(id: string | undefined): Account | undefined {
		return id ? this.accounts.find((a) => a.id === id) : undefined;
	}

	/** SecretStorage exists in Obsidian 1.11.4 and newer. */
	get secureStorageAvailable(): boolean {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ss = (this.plugin.app as any).secretStorage;
		return !!ss && typeof ss.getSecret === "function" && typeof ss.setSecret === "function";
	}

	private secretId(account: Account, kind: "rt" | "cs"): string {
		// IDs must be lowercase alphanumeric with dashes.
		return `omni-calendar-${account.id.toLowerCase().replace(/[^a-z0-9-]/g, "")}-${kind}`;
	}

	private getSecret(account: Account, kind: "rt" | "cs"): string | null {
		if (!this.secureStorageAvailable) return null;
		const v = this.plugin.app.secretStorage.getSecret(this.secretId(account, kind));
		return v ? v : null;
	}

	private setSecret(account: Account, kind: "rt" | "cs", value: string) {
		if (!this.secureStorageAvailable) throw new Error("Secure storage is not available. Please update Obsidian to 1.11.4 or newer.");
		this.plugin.app.secretStorage.setSecret(this.secretId(account, kind), value);
	}

	isSignedIn(account: Account): boolean {
		return !!this.getSecret(account, "rt");
	}

	hasClientSecret(account: Account): boolean {
		return !!this.getSecret(account, "cs");
	}

	newAccount(provider: AccountProvider, clientId: string, tenant?: string): Account {
		return { id: uid(), provider, label: provider === "google" ? "Google account" : "Microsoft account", clientId: clientId.trim(), tenant };
	}

	/** Store the Google client secret in secure storage (never in data.json). */
	setClientSecret(account: Account, secret: string) {
		this.setSecret(account, "cs", secret.trim());
	}

	/** Prepare a sign-in. The caller opens `session.authUrl` and awaits `completeSignIn`. */
	async beginSignIn(account: Account): Promise<AuthSession> {
		if (!this.secureStorageAvailable) {
			throw new Error("Secure storage is not available. Please update Obsidian to version 1.11.4 or newer to connect accounts.");
		}
		const provider = providerFor(account.provider);
		const cfg = provider.oauthConfig(account, this.getSecret(account, "cs") ?? undefined);
		if (!cfg.clientId) throw new Error("Client ID is missing.");
		if (account.provider === "google" && !cfg.clientSecret) throw new Error("Client secret is missing.");
		const session = new AuthSession(cfg);
		await session.start();
		return session;
	}

	/** Wait for the browser redirect, exchange the code and store the refresh token securely. */
	async completeSignIn(account: Account, session: AuthSession): Promise<RemoteCalendarInfo[]> {
		const code = await session.code;
		const tokens = await session.exchange(code);
		if (!tokens.refreshToken) {
			throw new OAuthError("no_refresh_token", "The provider did not return a refresh token. Remove the app's access in your account settings and try again.");
		}
		this.setSecret(account, "rt", tokens.refreshToken);
		this.tokens.set(account.id, { token: tokens.accessToken, expiresAt: tokens.expiresAt });
		this.needsReauth.delete(account.id);
		const calendars = await providerFor(account.provider).listCalendars(this.tokenGetter(account));
		const primary = calendars.find((c) => c.primary);
		if (!account.customLabel) {
			if (primary && account.provider === "google" && primary.id.includes("@")) account.label = primary.id;
			if (primary?.owner) account.label = primary.owner;
		}
		return calendars;
	}

	/** Returns a function that yields a valid access token for API calls. */
	tokenGetter(account: Account): TokenGetter {
		return (force?: boolean) => this.accessToken(account, !!force);
	}

	private async accessToken(account: Account, force: boolean): Promise<string> {
		const cached = this.tokens.get(account.id);
		if (!force && cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
		// De-duplicate concurrent refreshes.
		const pending = this.refreshing.get(account.id);
		if (pending) return pending;
		const p = this.doRefresh(account).finally(() => this.refreshing.delete(account.id));
		this.refreshing.set(account.id, p);
		return p;
	}

	private async doRefresh(account: Account): Promise<string> {
		const rt = this.getSecret(account, "rt");
		if (!rt) {
			this.needsReauth.add(account.id);
			throw new OAuthError("not_signed_in", "Not signed in on this device. Open Omni Calendar settings and sign in.");
		}
		const cfg = providerFor(account.provider).oauthConfig(account, this.getSecret(account, "cs") ?? undefined);
		try {
			const t = await refreshAccessToken(cfg, rt);
			// Microsoft rotates refresh tokens – store the new one.
			if (t.refreshToken && t.refreshToken !== rt) this.setSecret(account, "rt", t.refreshToken);
			this.tokens.set(account.id, { token: t.accessToken, expiresAt: t.expiresAt });
			this.needsReauth.delete(account.id);
			return t.accessToken;
		} catch (e) {
			if (e instanceof OAuthError && (e.code === "invalid_grant" || e.code === "unauthorized_client" || e.code === "invalid_client")) {
				this.needsReauth.add(account.id);
				this.tokens.delete(account.id);
				throw new OAuthError(e.code, "Access expired or was revoked. Sign in again in Omni Calendar settings.");
			}
			throw e;
		}
	}

	/** Revoke access (where the provider supports it) and delete all secrets of the account on this device. */
	async signOut(account: Account): Promise<void> {
		const rt = this.getSecret(account, "rt");
		const provider = providerFor(account.provider);
		if (rt && provider.revoke) {
			try {
				await provider.revoke(rt);
			} catch {
				/* best effort */
			}
		}
		if (this.secureStorageAvailable) {
			this.setSecret(account, "rt", "");
		}
		this.tokens.delete(account.id);
	}

	/** Remove the account, its secrets and its calendars. */
	async removeAccount(account: Account): Promise<void> {
		await this.signOut(account);
		if (this.secureStorageAvailable) this.setSecret(account, "cs", "");
		const s = this.plugin.settings;
		s.accounts = s.accounts.filter((a) => a.id !== account.id);
		s.sources = s.sources.filter((src) => src.accountId !== account.id);
	}

	/** Add / update calendar sources for the calendars of an account. */
	syncCalendarList(account: Account, calendars: RemoteCalendarInfo[], palette: string[]) {
		const s = this.plugin.settings;
		for (const cal of calendars) {
			const existing = s.sources.find((x) => x.accountId === account.id && x.remoteId === cal.id);
			if (existing) {
				existing.readOnly = cal.readOnly;
				continue;
			}
			const used = new Set(s.sources.map((x) => x.color));
			const color = cal.color && /^#[0-9a-f]{6}$/i.test(cal.color) ? cal.color : palette.find((c) => !used.has(c)) ?? palette[0];
			const src: CalendarSource = {
				id: uid(),
				name: cal.name,
				color,
				type: account.provider,
				enabled: cal.primary,
				accountId: account.id,
				remoteId: cal.id,
				readOnly: cal.readOnly,
			};
			s.sources.push(src);
		}
	}
}
