# Changelog

Fixes and small changes are made on `dev-branch` right away and listed under **Not released yet**.
They are released together when the maintainer asks for a release. At that point the section becomes the new version.
Bugs that are known but not fixed yet are listed under **Known bugs**, so nothing gets lost between sessions.

## Not released yet (1.8.0)

- **Tasks on events:** the event dialog has a *Tasks* section. Type a task and press Enter, tick it off right there.
  The event then shows its progress, e.g. *☐ 1/3*, in every view. This also works for Google, Outlook and
  subscribed (ICS) events; their tasks are kept only in Obsidian. Right-click an event → *Add task…* does the same.
- **Event tasks in the task lists:** they show the event's name under the task; click it to open the event.
  The task dialog shows the event too, with a button to detach the task from it.
- **Several linked notes per event:** *Link note* in the event dialog (and in the right-click menu) searches your vault.
  Works for local, Google, Outlook and ICS events; for the last three the links are kept only in Obsidian.
  *Create note* now adds the new note to this list. An event's earlier note is moved into the list automatically.
  A single repeat of a repeating event keeps its own notes.

## Known bugs

- *(none right now)*

## Released

Details of earlier versions are in the GitHub releases and pull requests. Recent highlights:

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
