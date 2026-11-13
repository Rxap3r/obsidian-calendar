import { requestUrl } from "obsidian";

export class ApiError extends Error {
	constructor(public status: number, message: string) {
		super(message);
		this.name = "ApiError";
	}
}

export type TokenGetter = (forceRefresh?: boolean) => Promise<string>;

/** Hosts the plugin is allowed to send access tokens to. */
const ALLOWED_HOSTS = new Set(["www.googleapis.com", "graph.microsoft.com"]);

/**
 * Authenticated JSON request. Retries once with a fresh token on 401.
 * Tokens are only ever sent over HTTPS to the provider API hosts above.
 */
export async function apiRequest(
	getToken: TokenGetter,
	opts: { url: string; method?: string; body?: unknown; headers?: Record<string, string> }
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	const target = new URL(opts.url);
	if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
		throw new ApiError(0, `Refusing to send credentials to ${target.hostname}`);
	}
	for (let attempt = 0; attempt < 2; attempt++) {
		const token = await getToken(attempt > 0);
		const res = await requestUrl({
			url: opts.url,
			method: opts.method ?? "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
				...(opts.headers ?? {}),
			},
			contentType: opts.body !== undefined ? "application/json" : undefined,
			body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
			throw: false,
		});
		if (res.status === 401 && attempt === 0) continue;
		if (res.status >= 200 && res.status < 300) {
			if (res.status === 204 || !res.text) return null;
			try {
				return res.json;
			} catch {
				return null;
			}
		}
		throw new ApiError(res.status, describeError(res.status, res.text));
	}
	throw new ApiError(401, "Not authorized – sign in again in Omni Calendar settings.");
}

function describeError(status: number, text: string): string {
	let detail = "";
	try {
		const j = JSON.parse(text);
		detail = j?.error?.message ?? j?.error_description ?? (typeof j?.error === "string" ? j.error : "");
	} catch {
		/* not JSON */
	}
	switch (status) {
		case 401: return "Not authorized – sign in again in Omni Calendar settings.";
		case 403: return `Permission denied${detail ? `: ${detail}` : ""}. You may only have read access to this calendar.`;
		case 404: return "Event or calendar not found – it may have been deleted elsewhere. Refresh and try again.";
		case 409:
		case 412: return "This event was changed elsewhere in the meantime. It has been refreshed – please check it and try again.";
		case 429: return "Too many requests – please wait a moment and try again.";
		default: return `HTTP ${status}${detail ? `: ${detail}` : ""}`;
	}
}
