# Changelog

Fixes and small changes are made on `dev-branch` right away and listed under **Not released yet**.
They are released together when the maintainer asks for a release. At that point the section becomes the new version.
Bugs that are known but not fixed yet are listed under **Known bugs**, so nothing gets lost between sessions.

## Not released yet (1.8.3)

- **Events with a time that run into the next day stay in the hour grid.** Before, an event from Monday 09:00 to
  Tuesday 10:00 was shown in the *all-day* row on both days, labelled 09:00–10:00, as if it were an all-day event.
  Now the week and day views show a block from 09:00 to the end of Monday (*09:00 →*) and one from the start of Tuesday
  to 10:00 (*→ 10:00*); days in between are filled (*→*). The name stays visible at the top while you scroll.
  Only events marked *All day* go into the all-day row.

## Known bugs

- *(none right now)*

## Released

Details of earlier versions are in the GitHub releases and pull requests. Recent highlights:

- **1.8.2** – An event's tasks move with the event when it moves to another day; drag to create can continue into the
  next days in the week view.
- **1.8.1** – Subtasks of event tasks shown in the event dialog; deleting an event deletes its tasks (after asking);
  moving an event to another calendar keeps its tasks and notes; tasks and notes can be added while creating an event;
  tasks whose event is gone are marked and can be kept or deleted.
- **1.8.0** – Tasks on events (with *2/5* progress on the event), several linked notes per event (also Google,
  Outlook and ICS, kept only in Obsidian), tasks in the calendar (light time blocks you can drag, one counter per
  day), *Tasks today* in the mini calendar, three new task settings for the calendar.
- **1.7.7** – Month view shows start and end times; dragged events in the week/day view land where the preview
  shows; old repeating events no longer disappear; settings tab arrows only when needed; internal clean-up
  (smaller files, tests on GitHub).
- **1.7.6** – All-day events created late in the evening no longer cover two days.
- **1.7.5** – Completed tasks: recent only, *Show older*, *Clear completed*, optional automatic clean-up;
  *Custom…* periods; the same standard choices in every period setting.
- **1.7.4** – The keyboard closes when tapping buttons after typing; *Upcoming* range setting for tasks.
- **1.7.3** – Date/time pickers no longer jump to the title field.
- **1.7.2** – Own date and time pickers, the same on every device.
- **1.7.1** – Task dialog fixes for phones, round checkboxes, open the Tasks page from the sidebar.
- **1.7.0** – Tasks: Tasks page, lists, priorities, time ranges, subtasks, linked notes.
