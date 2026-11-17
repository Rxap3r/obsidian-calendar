import { Setting } from "obsidian";
import { SidebarView, ViewMode } from "../types";
import { numberSetting, periodSetting, SettingsContext } from "./controls";

/** Readable names of Obsidian's built-in sidebar tabs (used when a saved tab is not open right now). */
const CORE_TAB_NAMES: Record<string, string> = {
	"file-explorer": "Files", search: "Search", bookmarks: "Bookmarks", tag: "Tags", backlink: "Backlinks",
	"outgoing-link": "Outgoing links", outline: "Outline", "all-properties": "All properties", "file-properties": "Properties",
};

/** Tab "Display": calendar look and the sidebar. */
export function displayTab(ctx: SettingsContext, el: HTMLElement) {
	const s = ctx.plugin.settings;
	new Setting(el).setName("Calendar").setHeading();
	new Setting(el).setName("Default view").setDesc("Used when the calendar page opens.").addDropdown((d) =>
		d
			.addOptions({ month: "Month", week: "Week", day: "Day", agenda: "Agenda" })
			.setValue(s.defaultView)
			.onChange(async (v) => {
				s.defaultView = v as ViewMode;
				await ctx.save();
			})
	);
	new Setting(el).setName("First day of the week").addDropdown((d) => {
		["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].forEach((n, i) => d.addOption(String(i), n));
		d.setValue(String(s.firstDayOfWeek)).onChange(async (v) => {
			s.firstDayOfWeek = parseInt(v);
			await ctx.save();
		});
	});
	new Setting(el).setName("24-hour clock").addToggle((t) =>
		t.setValue(s.use24h).onChange(async (v) => {
			s.use24h = v;
			await ctx.save();
		})
	);
	new Setting(el).setName("Show week numbers").addToggle((t) =>
		t.setValue(s.showWeekNumbers).onChange(async (v) => {
			s.showWeekNumbers = v;
			await ctx.save();
		})
	);
	new Setting(el)
		.setName("Events over several days")
		.setDesc("Week and day view: where events with a time that run into the next day go (e.g. Monday 09:00 – Tuesday 10:00). All-day events always use the all-day row.")
		.addDropdown((d) =>
			d
				.addOptions({ grid: "In the hours, one block per day", allday: "In the all-day row, with start and end" })
				.setValue(s.multiDayTimed)
				.onChange(async (v) => {
					s.multiDayTimed = v === "allday" ? "allday" : "grid";
					await ctx.save();
				})
		);
	numberSetting(ctx, el, "Scroll to hour", "Where week and day views start (0–23).", s.scrollToHour, 0, 23, (v) => (s.scrollToHour = v));
	numberSetting(ctx, el, "Default event length (minutes)", "", s.defaultEventDuration, 5, 1440, (v) => (s.defaultEventDuration = v));
	periodSetting(ctx, el, "Agenda length", "How many days the Agenda view shows.", s.agendaDays, {}, 1, 365, (v) => (s.agendaDays = v));

	new Setting(el).setName("Sidebar").setHeading();
	new Setting(el)
		.setName("Calendar in sidebar")
		.setDesc("Mini calendar: month overview with your upcoming events. Day planner: the calendar as a timeline next to your notes (opens in Day view, remembers the view you pick there). Applies right away and after restarts. Closing it yourself sets this to Off.")
		.addDropdown((d) =>
			d
				.addOptions({ none: "Off", mini: "Mini calendar", full: "Day planner" })
				.setValue(s.sidebarView)
				.onChange(async (v) => {
					s.sidebarView = v as SidebarView;
					await ctx.save();
					// Don't reveal/focus it: that would close this settings window.
					await ctx.plugin.sidebar.apply(false);
				})
		)
		.addDropdown((d) =>
			d
				.addOptions({ right: "Right side", left: "Left side" })
				.setValue(s.sidebarSide)
				.onChange(async (v) => {
					s.sidebarSide = v as "left" | "right";
					await ctx.save(true);
					await ctx.plugin.sidebar.apply(false);
					await ctx.plugin.sidebar.applyTasks(false);
				})
		);
	new Setting(el)
		.setName("When the day planner opens the calendar")
		.setDesc("What happens in the sidebar when you press ⤢ in the day planner to open the calendar.")
		.addDropdown((d) =>
			d
				.addOptions({ mini: "Switch to the mini calendar", close: "Close the day planner", keep: "Keep the day planner" })
				.setValue(s.sidebarOnExpand)
				.onChange(async (v) => {
					s.sidebarOnExpand = v as "mini" | "close" | "keep";
					await ctx.save(true);
				})
		);
	if (s.sidebarOnExpand === "close") {
		const side = s.sidebarSide === "left" ? "left" : "right";
		const opts: Record<string, string> = { "": "Let Obsidian decide" };
		for (const v of ctx.plugin.sidebar.otherTabs()) opts[v.type] = v.name;
		if (s.sidebarAfterClose && !(s.sidebarAfterClose in opts)) opts[s.sidebarAfterClose] = `${CORE_TAB_NAMES[s.sidebarAfterClose] ?? s.sidebarAfterClose} (not in the ${side} sidebar right now)`;
		new Setting(el)
			.setName("Then show this sidebar tab")
			.setDesc(`Which tab of the ${side} sidebar is shown after the day planner closes. The list shows the tabs that are in the ${side} sidebar right now.`)
			.setClass("ch-sub-setting")
			.addDropdown((d) =>
				d.addOptions(opts).setValue(s.sidebarAfterClose).onChange(async (v) => {
					s.sidebarAfterClose = v;
					await ctx.save();
				})
			);
	}
	periodSetting(ctx, el, "Upcoming list in the mini calendar", "How far ahead the “Upcoming” list below the mini calendar looks.",
		s.sidebarUpcomingDays, { before: [[0, "Hidden"], [1, "Tomorrow only"]], after: [[-1, "Same as agenda length"]] },
		1, 365, (v) => (s.sidebarUpcomingDays = v));
}
