import { LocalEvent, OmniCalendarSettings, PluginData } from "./types";
import { DEFAULT_SETTINGS } from "./defaults";
import { normalizeTaskData } from "./tasks";
import { clamp } from "./util";

export interface LoadedData {
	data: PluginData;
	/** Nothing was saved yet: the plugin was just installed. */
	firstRun: boolean;
	/** Saved by a version without the `sidebarView` setting, and nothing could be migrated into it. */
	sidebarViewUnset: boolean;
}

/** A whole number of days within min…max, or `fallback` when the stored value is not a number. */
function days(value: unknown, min: number, max: number, fallback: number): number {
	const n = Number(value);
	return Number.isFinite(n) ? clamp(Math.round(n), min, max) : fallback;
}

/**
 * Bring what is stored in data.json into a valid shape: defaults for missing settings, migrations from
 * older versions, and repairs (calendars without an account, unknown values, …).
 * When a setting changes its shape, add the migration here.
 */
export function normalizePluginData(loaded: Partial<PluginData> | null | undefined): LoadedData {
	const raw = loaded ?? {};
	const stored = raw.settings;
	const settings: OmniCalendarSettings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});

	// Calendars and accounts.
	settings.sources = (stored?.sources ?? DEFAULT_SETTINGS.sources).map((s) => ({ ...s }));
	settings.accounts = (stored?.accounts ?? []).map((a) => ({ ...a }));
	// Drop calendars whose account no longer exists.
	settings.sources = settings.sources.filter((s) => !s.accountId || settings.accounts.some((a) => a.id === s.accountId));
	if (!settings.sources.some((s) => s.type === "local")) settings.sources.unshift({ ...DEFAULT_SETTINGS.sources[0] });
	if (!settings.sources.some((s) => s.id === settings.defaultCalendarId && s.type === "local")) {
		settings.defaultCalendarId = settings.sources.find((s) => s.type === "local")?.id ?? "personal";
	}
	const targets = Array.isArray(stored?.defaultTargets) ? stored.defaultTargets : [settings.defaultCalendarId];
	settings.defaultTargets = targets.filter((id) => settings.sources.some((s) => s.id === id));
	if (!settings.defaultTargets.length) settings.defaultTargets = [settings.defaultCalendarId];

	// Sidebar. Migration: sidebarOnStartup (≤ 1.5.1) → sidebarView.
	let sidebarViewUnset = !stored?.sidebarView;
	if (sidebarViewUnset && stored?.sidebarOnStartup && stored.sidebarOnStartup !== "none") {
		settings.sidebarView = stored.sidebarOnStartup;
		sidebarViewUnset = false;
	}
	delete settings.sidebarOnStartup;
	if (!["month", "week", "day", "agenda"].includes(settings.sidebarCalendarMode)) settings.sidebarCalendarMode = "day";
	if (!["mini", "close", "keep"].includes(settings.sidebarOnExpand)) settings.sidebarOnExpand = "mini";
	if (settings.multiDayTimed !== "allday") settings.multiDayTimed = "grid";
	if (settings.clickOpens !== "edit") settings.clickOpens = "details";
	if (!["obsidian", "device", "en"].includes(settings.dateLanguage)) settings.dateLanguage = "obsidian";
	if (typeof settings.sidebarAfterClose !== "string") settings.sidebarAfterClose = "";
	settings.sidebarUpcomingDays = days(settings.sidebarUpcomingDays, -1, 365, DEFAULT_SETTINGS.sidebarUpcomingDays);

	// Tasks.
	if (![0, 1, 2, 3].includes(Number(settings.tasksDefaultPriority))) settings.tasksDefaultPriority = 0;
	settings.tasksUpcomingDays = days(settings.tasksUpcomingDays, 1, 3650, DEFAULT_SETTINGS.tasksUpcomingDays);
	// -1 = everything; anything else below one day is not a valid period.
	const visible = Number(settings.tasksDoneVisibleDays);
	settings.tasksDoneVisibleDays = visible === -1 ? -1 : Number.isFinite(visible) && visible >= 1 ? Math.min(3650, Math.round(visible)) : DEFAULT_SETTINGS.tasksDoneVisibleDays;
	// 0 = never.
	const deleteAfter = Number(settings.tasksDeleteDoneAfterDays);
	settings.tasksDeleteDoneAfterDays = Number.isFinite(deleteAfter) && deleteAfter >= 1 ? Math.min(3650, Math.round(deleteAfter)) : 0;
	for (const k of ["tasksInCalendar", "tasksCalendarShowDone", "tasksInMiniCalendar"] as const) {
		if (typeof settings[k] !== "boolean") settings[k] = DEFAULT_SETTINGS[k];
	}
	const tasks = normalizeTaskData(raw.tasks);
	if (!tasks.lists.some((l) => l.id === settings.tasksDefaultListId)) settings.tasksDefaultListId = tasks.lists[0].id;

	return {
		data: { settings, events: normalizeEvents(raw.events), tasks, eventLinks: normalizeEventLinks(raw.eventLinks) },
		firstRun: !loaded,
		sidebarViewUnset,
	};
}

/** Paths of linked notes: strings only, each once. */
function pathList(value: unknown): string[] {
	return Array.isArray(value) ? Array.from(new Set(value.filter((p): p is string => typeof p === "string" && !!p))) : [];
}

/** Local events. Migration ≤ 1.7: the single `notePath` becomes the first linked note. */
function normalizeEvents(value: unknown): LocalEvent[] {
	if (!Array.isArray(value)) return [];
	return value.filter((e) => e && typeof e.id === "string").map((e: LocalEvent) => {
		const ev: LocalEvent = { ...e };
		const links = pathList(ev.links);
		if (ev.notePath && !links.includes(ev.notePath)) links.unshift(ev.notePath);
		delete ev.notePath;
		if (links.length) ev.links = links;
		else delete ev.links;
		return ev;
	});
}

/** Linked notes of Google / Outlook / ICS events and of single repeats (by event key); empty entries are dropped. */
function normalizeEventLinks(value: unknown): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	if (!value || typeof value !== "object" || Array.isArray(value)) return out;
	for (const [key, paths] of Object.entries(value as Record<string, unknown>)) {
		const list = pathList(paths);
		if (list.length) out[key] = list;
	}
	return out;
}
