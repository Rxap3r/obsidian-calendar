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
