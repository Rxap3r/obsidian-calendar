/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Boots the real plugin against tests/ui/obsidian-mock.ts in a browser page.
 * Bundled by tests/ui/run.cjs into tests/.out/ui-bundle.js. See tests/README.md.
 *
 * window.boot(icsText, { mobile? }) creates:
 *   window.plugin – the plugin instance (store, accounts, settings, …)
 *   window.view   – a CalendarView (full calendar) rendered into #main
 *   window.mini   – a MiniCalendarView rendered into #side
 *   window.tab    – the settings tab (call tab.display() and append tab.containerEl)
 *   window.ws     – the fake workspace (leaves, splits, fireLayoutChange())
 * Fixtures: local events around "today" (frozen by the test runner), a Work calendar,
 * a fake signed-in Google account with one writable + one read-only calendar, and the ICS file.
 */
import OmniCalendarPlugin from "../../src/main";
import { CalendarView } from "../../src/views/CalendarView";
import { MiniCalendarView } from "../../src/views/MiniCalendarView";
import { OmniCalendarSettingTab } from "../../src/settings";
import { IcsCalendar } from "../../src/ics";

function fakeWorkspace() {
	const leftSplit = { name: "left", collapsed: false };
	const rightSplit = { name: "right", collapsed: false };
	const rootSplit = { name: "main" };
	const leaves: any[] = [];
	const layoutCbs: (() => void)[] = [];
	const mk = (root: any) => {
		const l: any = {
			root, vs: { type: null, state: {} },
			getRoot() { return this.root; },
			getViewState() { return this.vs; },
			async setViewState(v: any) { this.vs = v; },
			detach() { const i = leaves.indexOf(this); if (i >= 0) leaves.splice(i, 1); },
		};
		leaves.push(l);
		return l;
	};
	return {
		leftSplit, rightSplit, rootSplit, leaves, mk,
		onLayoutReady: (f: () => void) => f(),
		requestSaveLayout() {},
		getLeavesOfType: (t: string) => leaves.filter((l) => l.vs.type === t),
		getLeaf: () => mk(rootSplit),
		getRightLeaf: () => mk(rightSplit),
		getLeftLeaf: () => mk(leftSplit),
		revealLeaf: async () => {},
		on: (name: string, cb: () => void) => { if (name === "layout-change") layoutCbs.push(cb); return {}; },
		fireLayoutChange: () => layoutCbs.forEach((cb) => cb()),
	};
}

(window as any).boot = async (ics: string, opts: { mobile?: boolean } = {}) => {
	(window as any).__Platform.isMobile = !!opts.mobile;
	const files: Record<string, string> = {};
	const secrets: Record<string, string> = {};
	const ws = fakeWorkspace();
	const app: any = {
		vault: {
			adapter: {
				exists: async (p: string) => p in files, read: async (p: string) => files[p],
				write: async (p: string, d: string) => { files[p] = d; }, mkdir: async () => {}, remove: async () => {},
			},
			on: () => ({}), getAbstractFileByPath: () => null,
		},
		secretStorage: {
			getSecret: (id: string) => secrets[id] ?? null,
			setSecret: (id: string, v: string) => { secrets[id] = v; },
			listSecrets: () => Object.keys(secrets),
		},
		workspace: ws,
	};
	(window as any).ws = ws;
	(window as any).secrets = secrets;

	const plugin: any = new (OmniCalendarPlugin as any)(app);
	await plugin.onload();

	// ---- fixtures
	plugin.settings.sources.push({ id: "work", name: "Work", color: "#2f9e44", type: "local", enabled: true });
	const ext = { id: "ics1", name: "Subscribed (ICS)", color: "#e8590c", type: "ics", enabled: true, url: "" };
	plugin.settings.sources.push(ext);
	plugin.store.ics.set("ics1", new IcsCalendar(ext as any, ics));

	const acc = { id: "acc1", provider: "google", label: "me@gmail.com", clientId: "own-client.apps.googleusercontent.com" };
	plugin.settings.accounts.push(acc);
	secrets["omni-calendar-acc1-rt"] = "RT";
	plugin.settings.sources.push(
		{ id: "gcal", name: "Mine (Google)", color: "#1c7ed6", type: "google", enabled: true, accountId: "acc1", remoteId: "primary", readOnly: false },
		{ id: "gro", name: "Holidays (Google)", color: "#0ca678", type: "google", enabled: false, accountId: "acc1", remoteId: "holidays", readOnly: true },
	);

	const t = new Date();
	const D = (o: number, h: number, m = 0) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + o, h, m);
	const key = (o: number, h?: number, m = 0) => {
		const x = new Date(t.getFullYear(), t.getMonth(), t.getDate() + o);
		const p = (n: number) => String(n).padStart(2, "0");
		const k = `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
		return h === undefined ? k : `${k}T${p(h)}:${p(m)}`;
	};
	plugin.store.remote.set("gcal", [
		{ id: "g1", etag: '"1"', title: "Dentist (Google)", start: D(1, 14), end: D(1, 15), allDay: false, location: "Main street" },
		{ id: "g2_x", seriesId: "g2", title: "Team lunch (Google series)", start: D(0, 12), end: D(0, 13), allDay: false },
	]);
	plugin.store.status.set("gcal", { lastFetched: Date.now(), eventCount: 2 });
	const add = (e: any) => plugin.store.addEvent({ calendarId: "personal", allDay: false, exdates: [], ...e });
	await add({ title: "Standup", start: key(0, 9), end: key(0, 9, 30), recurrence: { freq: "daily", interval: 1, count: 20 }, calendarId: "work" });
	await add({ title: "Design review", start: key(0, 10), end: key(0, 11, 30), location: "Room 4", calendarId: "work" });
	await add({ title: "Overlapping call", start: key(0, 11), end: key(0, 12) });
	await add({ title: "Gym", start: key(1, 18), end: key(1, 19, 30) });
	await add({ title: "Vacation", allDay: true, start: key(3), end: key(6) });
	await add({ title: "Birthday", allDay: true, start: key(8), end: key(8), recurrence: { freq: "yearly", interval: 1 } });
	for (let i = 0; i < 5; i++) await add({ title: `Busy ${i}`, start: key(2, 8 + i), end: key(2, 9 + i) });
	(window as any).plugin = plugin;

	// ---- views
	const mainLeaf: any = ws.mk(ws.rootSplit);
	mainLeaf.app = app;
	const view = new CalendarView(mainLeaf, plugin);
	mainLeaf.vs = { type: "omni-calendar-view", state: {} };
	mainLeaf.view = view;
	document.getElementById("main")!.appendChild(view.contentEl);
	await view.onOpen();
	const sideLeaf: any = { app };
	const mini = new MiniCalendarView(sideLeaf, plugin);
	document.getElementById("side")!.appendChild(mini.contentEl);
	await mini.onOpen();
	(window as any).view = view;
	(window as any).mini = mini;
	(window as any).tab = new OmniCalendarSettingTab(app, plugin);
};
