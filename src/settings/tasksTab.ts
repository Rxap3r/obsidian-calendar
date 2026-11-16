import { Setting } from "obsidian";
import { nextColor } from "../defaults";
import { DEFAULT_TASK_LIST, PRIORITY_NAMES } from "../tasks";
import { deleteTaskList } from "../modals/confirmations";
import { periodSetting, SettingsContext } from "./controls";

/** Tab "Tasks": main switch, sidebar, completed tasks, defaults, lists. */
export function tasksTab(ctx: SettingsContext, el: HTMLElement) {
	const s = ctx.plugin.settings;
	const store = ctx.plugin.tasks;
	new Setting(el).setName("Tasks").setHeading();
	new Setting(el)
		.setName("Use tasks")
		.setDesc("Turns the Tasks page, its menu entries and commands on or off. Turning it off deletes nothing.")
		.addToggle((t) =>
			t.setValue(s.tasksEnabled).onChange(async (v) => {
				s.tasksEnabled = v;
				await ctx.save(true);
				await ctx.plugin.sidebar.applyTasks(false);
				store.trigger("changed");
			})
		);
	if (!s.tasksEnabled) return;

	new Setting(el)
		.setName("Tasks in sidebar")
		.setDesc(`Shows the Tasks page in the ${s.sidebarSide} sidebar, next to the mini calendar or day planner. The side follows “Calendar in sidebar” (Display tab).`)
		.addToggle((t) =>
			t.setValue(s.tasksSidebar).onChange(async (v) => {
				s.tasksSidebar = v;
				await ctx.save();
				await ctx.plugin.sidebar.applyTasks(false);
			})
		);
	new Setting(el)
		.setName("Done section in lists")
		.setDesc("Adds a collapsed “Done” section with completed tasks to your lists and “All”. The “Done” list always shows them.")
		.addToggle((t) =>
			t.setValue(s.tasksShowCompleted).onChange(async (v) => {
				s.tasksShowCompleted = v;
				await ctx.save();
				store.trigger("changed");
			})
		);
	periodSetting(ctx, el, "Upcoming list", "How far ahead the “Upcoming” task list looks (today plus this many days). Later tasks are under “All”.",
		s.tasksUpcomingDays, {},
		1, 3650, (v) => { s.tasksUpcomingDays = v; store.trigger("changed"); });

	new Setting(el).setName("In the calendar").setHeading();
	new Setting(el)
		.setName("Tasks in the calendar")
		.setDesc("Tasks with a time appear as light blocks in Week and Day. Tasks with only a date are counted once per day (☐ 3); tap the counter to see them.")
		.addToggle((t) =>
			t.setValue(s.tasksInCalendar).onChange(async (v) => {
				s.tasksInCalendar = v;
				await ctx.save(true);
				store.trigger("changed");
			})
		);
	if (s.tasksInCalendar) {
		new Setting(el)
			.setName("Completed tasks in the calendar")
			.setDesc("Ticked-off tasks stay visible, struck through, or are hidden from the calendar.")
			.addDropdown((d) =>
				d
					.addOptions({ show: "Struck through", hide: "Hidden" })
					.setValue(s.tasksCalendarShowDone ? "show" : "hide")
					.onChange(async (v) => {
						s.tasksCalendarShowDone = v === "show";
						await ctx.save();
						store.trigger("changed");
					})
			);
	}
	new Setting(el)
		.setName("Tasks today in the mini calendar")
		.setDesc("A small “Tasks today” section in the mini calendar: today's and overdue tasks, to tick off directly.")
		.addToggle((t) =>
			t.setValue(s.tasksInMiniCalendar).onChange(async (v) => {
				s.tasksInMiniCalendar = v;
				await ctx.save();
				store.trigger("changed");
			})
		);

	new Setting(el).setName("Completed tasks").setHeading();
	periodSetting(ctx, el, "Show completed tasks from the last", "The Done list and Done sections show tasks completed in this period. Older ones stay available behind “Show older”.",
		s.tasksDoneVisibleDays, { after: [[-1, "Everything"]] },
		1, 3650, (v) => { s.tasksDoneVisibleDays = v; store.trigger("changed"); });
	periodSetting(ctx, el, "Delete completed tasks after", "Completed tasks are deleted automatically this long after you ticked them off. Deleting can't be undone.",
		s.tasksDeleteDoneAfterDays, { before: [[0, "Never"]] },
		1, 3650, (v) => { s.tasksDeleteDoneAfterDays = v; void ctx.plugin.cleanUpDoneTasks(); });
	new Setting(el).setName("Default priority").addDropdown((d) =>
		d
			.addOptions({ 0: PRIORITY_NAMES[0], 1: PRIORITY_NAMES[1], 2: PRIORITY_NAMES[2], 3: PRIORITY_NAMES[3] })
			.setValue(String(s.tasksDefaultPriority))
			.onChange(async (v) => {
				s.tasksDefaultPriority = Number(v) as 0 | 1 | 2 | 3;
				await ctx.save();
			})
	);
	new Setting(el)
		.setName("Default list")
		.setDesc("Used for new tasks that aren't created inside a specific list.")
		.addDropdown((d) => {
			for (const l of store.lists) d.addOption(l.id, l.name);
			d.setValue(s.tasksDefaultListId).onChange(async (v) => {
				s.tasksDefaultListId = v;
				await ctx.save();
			});
		});

	new Setting(el).setName("Lists").setDesc("Your task lists. Deleting a list moves its tasks to “Tasks”.").setHeading();
	for (const l of store.lists) {
		const row = new Setting(el).setClass("ch-task-list-setting");
		row.addColorPicker((c) =>
			c.setValue(l.color).onChange(async (v) => {
				await store.updateList(l.id, { color: v });
			})
		);
		row.addText((t) =>
			t.setValue(l.name).onChange(async (v) => {
				if (v.trim()) await store.updateList(l.id, { name: v.trim() });
			})
		);
		row.setDesc(`${store.items.filter((x) => x.listId === l.id && !x.done).length} open tasks${l.id === DEFAULT_TASK_LIST.id ? " · default list, can't be deleted" : ""}`);
		if (l.id !== DEFAULT_TASK_LIST.id) {
			row.addExtraButton((b) =>
				b.setIcon("trash").setTooltip("Delete list").onClick(async () => {
					if (await deleteTaskList(ctx.plugin, l)) ctx.redraw();
				})
			);
		}
	}
	new Setting(el).addButton((b) =>
		b.setButtonText("Add list").onClick(async () => {
			await store.addList("New list", nextColor(store.lists.map((l) => l.color), store.lists.length));
			ctx.redraw();
		})
	);
}
