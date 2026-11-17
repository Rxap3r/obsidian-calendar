/**
 * The explanations shown in the sign-in dialog: what to expect from quick sign-in, and the step-by-step
 * guides for people who use their own app registration. Text only – no logic.
 */

export interface SetupGuide {
	title: string;
	needs: string[];
	steps: string[];
	problems: string[];
}

export const GOOGLE_GUIDE: SetupGuide = {
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

export const MS_WORK_GUIDE: SetupGuide = {
	title: "One-time setup: Microsoft app for a work/school account (≈10 minutes, free)",
	needs: [
		"A work or school Microsoft 365 account.",
		"Permission to register apps in your organisation (usually allowed; otherwise ask IT to create it with the steps below).",
		"No client secret and no cost.",
	],
	steps: [
		"Open entra.microsoft.com (or portal.azure.com) with your work account → App registrations → New registration.",
		"Name: anything. Supported account types: “Accounts in this organizational directory only” or “Accounts in any organizational directory”.",
		"Redirect URI: platform “Public client/native (mobile & desktop)”, value http://localhost → Register. (Adding it later under Authentication → Add a platform: choose “Mobile and desktop applications”, not “Web”.)",
		"API permissions → Add a permission → Microsoft Graph → Delegated → Calendars.ReadWrite → Add permissions.",
		"Overview → copy the Application (client) ID into the field below. For a single-organisation app choose “Single organisation” above and also copy the Directory (tenant) ID.",
	],
	problems: [
		"“Need admin approval” or AADSTS65001 → ask IT to “Grant admin consent” for Calendars.ReadWrite on your app.",
		"AADSTS700016 “application … was not found in the directory” → the client ID is wrong or incomplete, or the account type chosen below doesn't match the app's Supported account types.",
		"AADSTS50011 “redirect URI … does not match” → the redirect URI must be exactly http://localhost (not https, not 127.0.0.1, no slash at the end).",
		"AADSTS7000218 “must contain client_assertion or client_secret” → the redirect URI was added under platform “Web”; remove it there and add it under “Mobile and desktop applications”.",
		"AADSTS50194 “not configured as multi-tenant” → choose “Single organisation” and enter the tenant ID.",
	],
};

export const MS_PERSONAL_GUIDE: SetupGuide = {
	title: "One-time setup: Microsoft app for a personal account (≈20–30 minutes, free)",
	needs: [
		"Your Outlook.com / Hotmail / Live account.",
		"A free Azure account (azure.microsoft.com/free). Microsoft only allows app registrations inside a “directory”, and personal accounts get one through this sign-up. Microsoft asks for a phone number and a credit card to verify your identity; the app registration itself costs nothing.",
		"A desktop computer for this setup.",
	],
	steps: [
		"Sign up at azure.microsoft.com/free with your Outlook.com account (skip if you already have Azure).",
		"Open portal.azure.com → search “App registrations” → New registration.",
		"Name: anything. Supported account types: “Personal Microsoft accounts only” (or “… organizational directory and personal Microsoft accounts”). Important: this is NOT the preselected option – changing it later is fiddly.",
		"Redirect URI: platform “Public client/native (mobile & desktop)”, value http://localhost → Register. (Adding it later under Authentication → Add a platform: choose “Mobile and desktop applications”, not “Web”.)",
		"API permissions → Add a permission → Microsoft Graph → Delegated → Calendars.ReadWrite → Add permissions.",
		"Overview → copy the Application (client) ID into the field below and click “Sign in with Microsoft”.",
	],
	problems: [
		"No directory / cannot create app registrations → finish the Azure sign-up (step 1).",
		"AADSTS50020 “account does not exist in tenant” → the app does not allow personal accounts; change Supported account types under Authentication.",
		"“unauthorized_client” (“not enabled for consumers”) → the app doesn't allow personal accounts. Easiest: create a new app registration and choose “Personal Microsoft accounts only” (step 3). Otherwise see the next point. Less often, the redirect URI isn't platform “Public client/native” with value exactly http://localhost.",
		"AADSTS700016 “application … was not found in the directory” → the client ID is wrong or incomplete, or the account type chosen below doesn't match the app's Supported account types.",
		"AADSTS50011 “redirect URI … does not match” → the redirect URI must be exactly http://localhost (not https, not 127.0.0.1, no slash at the end).",
		"AADSTS7000218 “must contain client_assertion or client_secret” → the redirect URI was added under platform “Web”; remove it there and add it under “Mobile and desktop applications”.",
		"“Property api.requestedAccessTokenVersion is invalid” when allowing personal accounts → open the app's Manifest, in the \"api\" section change \"requestedAccessTokenVersion\": null to 2, save, then change Supported account types again (or simply create a new app registration with personal accounts).",
	],
};

export const TENANT_OPTIONS: Record<string, string> = {
	consumers: "Personal – Outlook.com, Hotmail, Live",
	organizations: "Work or school – Microsoft 365",
	other: "Work or school – single organisation (tenant ID)",
	common: "Both personal and work/school",
};

/** Quick sign-in with Google: what the user will see. */
export const GOOGLE_QUICK_NOTES: string[] = [
	"Google shows “Google hasn’t verified this app”. This is expected while Omni Calendar is not yet verified by Google: click “Advanced” → “Go to Omni Calendar (unsafe)”. The wording is Google's standard text for apps that have not completed Google's review – the sign-in itself is Google's normal, secure sign-in.",
	"Google then asks you to allow Omni Calendar to view and edit events in your calendars and to see your list of calendars. Nothing else – no e-mail, contacts, Drive or profile. Tick both boxes and click Continue.",
	"Until Google has verified the app, it is limited to 100 users in total. If sign-in is refused for that reason, choose “Use my own app registration”.",
	"Google Workspace (work/school) accounts: your administrator may block apps that are not verified.",
	"You can remove the access anytime: Omni Calendar → Sign out, and myaccount.google.com → Security → Third-party connections.",
];

/** Quick sign-in with Microsoft: what the user will see. */
export const MS_QUICK_NOTES: string[] = [
	"Microsoft asks you to allow “Omni Calendar” to read and write your calendars and to keep access (so you stay signed in). Nothing else – no e-mail, contacts or files.",
	"The app may be labelled “unverified”. That only means the publisher has not completed Microsoft's paid partner verification; the sign-in itself is the standard, secure Microsoft sign-in.",
	"Work or school accounts: your organisation may require an administrator to approve the app first (“Need admin approval”). Ask IT, or choose “Use my own app registration”.",
	"You can remove the access anytime: Omni Calendar → Sign out, and account.microsoft.com → Privacy → Apps and services.",
];
