# Changelog

Fixes and small changes are made on `dev-branch` right away and listed under **Not released yet**.
They are released together when the maintainer asks for a release. At that point the section becomes the new version.
Bugs that are known but not fixed yet are listed under **Known bugs**, so nothing gets lost between sessions.

## Not released yet (1.8.1)

- **Subtasks of an event's tasks are visible in the event dialog.** Before, subtasks added in the task dialog were only
  shown on the Tasks page. Now each task in the event's *Tasks* section shows its subtask progress (e.g. *1/3*) with the
  subtasks underneath; tick them off right there, or click the count to fold them away.
- **Deleting an event now deletes its tasks.** Before, they stayed behind with a link to an event that no longer
  existed. If the event has tasks, you're asked first ("Its 2 tasks will be deleted too"). Deleting one repeat
  deletes only that repeat's tasks. Linked notes are only unlinked; the notes stay.
- **Moving an event to another calendar keeps its tasks and linked notes** (e.g. from Obsidian to Google).
- **Tasks whose event is gone** (deleted before this fix, or in Google/Outlook directly) show the event name crossed out.
  Clicking it asks whether to keep the task without the event or delete it.

## Known bugs

- *(none right now)*

## Released

Details of earlier versions are in the GitHub releases and pull requests. Recent highlights:

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
