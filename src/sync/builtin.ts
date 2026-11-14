/**
 * Built-in app registrations published by the Omni Calendar maintainer.
 *
 * These are public client IDs (no secret): every desktop/mobile app's client ID is visible to its users.
 * Security does not depend on keeping them secret – sign-in uses PKCE, tokens stay on the user's device,
 * and no Omni Calendar server is involved. Users can always use their own app registration instead.
 */

/** Microsoft Entra app "Omni Calendar" – personal and work/school accounts, delegated Calendars.ReadWrite. */
export const BUILTIN_MICROSOFT_CLIENT_ID = "1e7d229a-9312-4a0b-a79b-1d5a9902c129";
/** Accept both personal (Outlook.com) and work/school accounts. */
export const BUILTIN_MICROSOFT_TENANT = "common";

export function isBuiltinMicrosoftClient(clientId: string | undefined): boolean {
	return (clientId ?? "").toLowerCase() === BUILTIN_MICROSOFT_CLIENT_ID;
}

/**
 * Google Cloud OAuth client "Omni Calendar" (type: Desktop app).
 *
 * Injected at build time from the environment variables OMNI_GOOGLE_CLIENT_ID and
 * OMNI_GOOGLE_CLIENT_SECRET (GitHub repository secrets in the release workflow), so they are
 * not stored in the source code. For installed apps Google documents the client secret as not
 * confidential – it ends up in the released main.js like the client ID, and cannot be used to
 * access any account without the user's own sign-in on their device.
 * If the build has no Google client, quick sign-in for Google is simply not offered.
 */
declare const __OMNI_GOOGLE_CLIENT_ID__: string;
declare const __OMNI_GOOGLE_CLIENT_SECRET__: string;
export const BUILTIN_GOOGLE_CLIENT_ID: string = typeof __OMNI_GOOGLE_CLIENT_ID__ === "string" ? __OMNI_GOOGLE_CLIENT_ID__ : "";
export const BUILTIN_GOOGLE_CLIENT_SECRET: string = typeof __OMNI_GOOGLE_CLIENT_SECRET__ === "string" ? __OMNI_GOOGLE_CLIENT_SECRET__ : "";

export function hasBuiltinGoogleClient(): boolean {
	return !!BUILTIN_GOOGLE_CLIENT_ID && !!BUILTIN_GOOGLE_CLIENT_SECRET;
}

export function isBuiltinGoogleClient(clientId: string | undefined): boolean {
	return hasBuiltinGoogleClient() && (clientId ?? "") === BUILTIN_GOOGLE_CLIENT_ID;
}

export function isBuiltinClient(provider: "google" | "outlook", clientId: string | undefined): boolean {
	return provider === "google" ? isBuiltinGoogleClient(clientId) : isBuiltinMicrosoftClient(clientId);
}
