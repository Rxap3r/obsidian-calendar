import { Platform, requestUrl } from "obsidian";

/**
 * OAuth 2.0 Authorization Code flow with PKCE (RFC 7636) for installed apps (RFC 8252).
 *
 * Security properties:
 * - The user signs in in their own browser; the plugin never sees the password.
 * - PKCE (S256) binds the authorization code to this sign-in attempt, so a code that leaks
 *   (e.g. via browser history) cannot be redeemed by anyone else.
 * - A random `state` value is checked to reject forged / cross-site redirects.
 * - On desktop the redirect is received by a one-shot HTTP server bound to the loopback
 *   interface only (not reachable from the network). It accepts a single valid callback
 *   and shuts down, or closes after a timeout.
 * - Only the fixed HTTPS endpoints of Google / Microsoft are contacted.
 */

export interface OAuthProviderConfig {
	authUrl: string;
	tokenUrl: string;
	clientId: string;
	/** Google "Desktop app" clients require it (Google documents it as non-confidential). */
	clientSecret?: string;
	scopes: string[];
	extraAuthParams?: Record<string, string>;
	/** Host used in the redirect URI. Google: 127.0.0.1, Microsoft: localhost. */
	redirectHost: "127.0.0.1" | "localhost";
}

export interface TokenResponse {
	accessToken: string;
	expiresAt: number;
	refreshToken?: string;
	scope?: string;
}

export class OAuthError extends Error {
	constructor(public code: string, description?: string) {
		super(description ? `${code}: ${description}` : code);
		this.name = "OAuthError";
	}
}

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
/** Fixed port used for the manual (copy & paste) flow on mobile. Nothing listens on it. */
const MANUAL_PORT = 53682;

function base64Url(bytes: Uint8Array): string {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLength: number): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return base64Url(bytes);
}

async function sha256(input: string): Promise<Uint8Array> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return new Uint8Array(digest);
}

/** Constant-time string comparison (avoids timing side channels on `state`). */
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

const CALLBACK_PAGE = (ok: boolean, msg: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>Omni Calendar</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:90vh;margin:0}
div{max-width:420px;text-align:center}h1{font-size:1.3em}</style></head>
<body><div><h1>${ok ? "✅ Signed in" : "❌ Sign-in failed"}</h1><p>${msg}</p></div></body></html>`;

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** One sign-in attempt. Call `start()`, open `authUrl`, then await `code`. */
export class AuthSession {
	readonly state = randomString(32);
	private readonly verifier = randomString(64);
	redirectUri = "";
	authUrl = "";
	/** True when a loopback server receives the redirect automatically. */
	automatic = false;

	private resolveCode!: (code: string) => void;
	private rejectCode!: (err: Error) => void;
	readonly code: Promise<string>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private servers: any[] = [];
	private timer: number | null = null;
	private settled = false;

	constructor(private cfg: OAuthProviderConfig) {
		this.code = new Promise<string>((res, rej) => {
			this.resolveCode = res;
			this.rejectCode = rej;
		});
		// Avoid unhandled-rejection noise if nobody awaits a cancelled session.
		this.code.catch(() => undefined);
	}

	async start(): Promise<void> {
		let port = MANUAL_PORT;
		if (Platform.isDesktopApp) {
			try {
				port = await this.startLoopbackServer();
				this.automatic = true;
			} catch (e) {
				console.warn("Omni Calendar: loopback server unavailable, using manual sign-in", e);
			}
		}
		this.redirectUri = `http://${this.cfg.redirectHost}:${port}`;
		const challenge = base64Url(await sha256(this.verifier));
		const params = new URLSearchParams({
			client_id: this.cfg.clientId,
			redirect_uri: this.redirectUri,
			response_type: "code",
			scope: this.cfg.scopes.join(" "),
			state: this.state,
			code_challenge: challenge,
			code_challenge_method: "S256",
			...(this.cfg.extraAuthParams ?? {}),
		});
		this.authUrl = `${this.cfg.authUrl}?${params.toString()}`;
		this.timer = window.setTimeout(() => this.fail(new OAuthError("timeout", "Sign-in was not completed within 5 minutes.")), CALLBACK_TIMEOUT_MS);
	}

	/**
	 * Manual flow: the user pastes the address of the page the browser was redirected to
	 * (it shows "can't connect" because nothing listens there – that is expected).
	 */
	submitRedirectUrl(pasted: string): void {
		let url: URL;
		try {
			url = new URL(pasted.trim());
		} catch {
			throw new OAuthError("invalid_url", "That is not a valid address. Copy the full address from the browser's address bar.");
		}
		const expected = new URL(this.redirectUri);
		if (url.hostname !== expected.hostname || url.port !== expected.port) {
			throw new OAuthError("invalid_url", `The address must start with ${this.redirectUri}`);
		}
		const err = this.handleParams(url.searchParams);
		if (err) throw new OAuthError("callback", err);
	}

	/** Validates callback parameters; returns an error message or null on success. */
	private handleParams(params: URLSearchParams): string | null {
		if (this.settled) return "This sign-in attempt is already finished.";
		const state = params.get("state") ?? "";
		if (!safeEqual(state, this.state)) {
			// Do not fail the session: a forged request must not be able to cancel a real sign-in.
			return "Invalid state – this response does not belong to the current sign-in. Start again from Obsidian.";
		}
		const error = params.get("error");
		if (error) {
			this.fail(new OAuthError(error, params.get("error_description") ?? undefined));
			return params.get("error_description") ?? error;
		}
		const code = params.get("code");
		if (!code) return "No authorization code in the response.";
		this.settled = true;
		this.cleanup();
		this.resolveCode(code);
		return null;
	}

	private fail(err: Error) {
		if (this.settled) return;
		this.settled = true;
		this.cleanup();
		this.rejectCode(err);
	}

	cancel() {
		this.fail(new OAuthError("cancelled", "Sign-in cancelled."));
	}

	private cleanup() {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
		for (const s of this.servers) {
			try {
				s.close();
			} catch {
				/* ignore */
			}
		}
		this.servers = [];
	}

	/** Start a loopback-only HTTP server on a random free port. Desktop only. */
	private startLoopbackServer(): Promise<number> {
		// Loaded lazily: Node modules do not exist on mobile.
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const http = require("http") as typeof import("http");
		const handler = (req: import("http").IncomingMessage, res: import("http").ServerResponse) => {
			const send = (status: number, ok: boolean, msg: string) => {
				res.writeHead(status, {
					"Content-Type": "text/html; charset=utf-8",
					"Cache-Control": "no-store",
					"Referrer-Policy": "no-referrer",
					"X-Content-Type-Options": "nosniff",
					Connection: "close",
				});
				res.end(CALLBACK_PAGE(ok, escapeHtml(msg)));
			};
			if (req.method !== "GET" || !req.url) return send(405, false, "Method not allowed.");
			const url = new URL(req.url, "http://localhost");
			if (url.pathname !== "/") return send(404, false, "Not found.");
			if (!url.searchParams.has("state")) return send(400, false, "Missing parameters.");
			const err = this.handleParams(url.searchParams);
			if (err) send(400, false, err);
			else send(200, true, "You can close this tab and return to Obsidian.");
		};

		const listen = (host: string, port: number) =>
			new Promise<import("http").Server>((resolve, reject) => {
				const server = http.createServer(handler);
				server.on("error", reject);
				server.listen(port, host, () => resolve(server));
			});

		return (async () => {
			const primary = await listen("127.0.0.1", 0);
			this.servers.push(primary);
			const addr = primary.address();
			const port = typeof addr === "object" && addr ? addr.port : 0;
			if (!port) throw new Error("Could not determine loopback port");
			if (this.cfg.redirectHost === "localhost") {
				// "localhost" may resolve to the IPv6 loopback; listen there too (still loopback-only).
				try {
					this.servers.push(await listen("::1", port));
				} catch {
					/* IPv6 not available – fine */
				}
			}
			return port;
		})();
	}

	/** Exchange the authorization code for tokens. */
	async exchange(code: string): Promise<TokenResponse> {
		const body: Record<string, string> = {
			grant_type: "authorization_code",
			code,
			client_id: this.cfg.clientId,
			redirect_uri: this.redirectUri,
			code_verifier: this.verifier,
		};
		if (this.cfg.clientSecret) body.client_secret = this.cfg.clientSecret;
		if (this.cfg.redirectHost === "localhost") body.scope = this.cfg.scopes.join(" ");
		return tokenRequest(this.cfg.tokenUrl, body);
	}
}

export async function refreshAccessToken(cfg: OAuthProviderConfig, refreshToken: string): Promise<TokenResponse> {
	const body: Record<string, string> = {
		grant_type: "refresh_token",
		refresh_token: refreshToken,
		client_id: cfg.clientId,
	};
	if (cfg.clientSecret) body.client_secret = cfg.clientSecret;
	if (cfg.redirectHost === "localhost") body.scope = cfg.scopes.join(" ");
	return tokenRequest(cfg.tokenUrl, body);
}

async function tokenRequest(url: string, body: Record<string, string>): Promise<TokenResponse> {
	const res = await requestUrl({
		url,
		method: "POST",
		contentType: "application/x-www-form-urlencoded",
		headers: { Accept: "application/json" },
		body: new URLSearchParams(body).toString(),
		throw: false,
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let json: any = {};
	try {
		json = res.json;
	} catch {
		/* not JSON */
	}
	if (res.status < 200 || res.status >= 300 || !json?.access_token) {
		// Never include the request (it contains the code / refresh token) in the error.
		throw new OAuthError(String(json?.error ?? `http_${res.status}`), json?.error_description ? String(json.error_description).split("\n")[0] : undefined);
	}
	return {
		accessToken: String(json.access_token),
		expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
		refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
		scope: json.scope ? String(json.scope) : undefined,
	};
}
