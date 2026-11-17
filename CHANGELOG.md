# Changelog

Fixes and small changes are made on `dev-branch` right away and listed under **Not released yet**.
They are released together when the maintainer asks for a release. At that point the section becomes the new version.
Bugs that are known but not fixed yet are listed under **Known bugs**, so nothing gets lost between sessions.

## Not released yet (1.9.4)

- The switch for *Create note* is now two switches in *Settings → Omni Calendar → Tasks*: **Create note for tasks** (turns
  off notes for tasks and subtasks) and, under it, **Notes and descriptions on subtasks** (turns off only the subtask
  part, so subtasks stay simple while tasks keep *Create note*). The subtask switch is **off by default**: turn it on to
  see subtask descriptions and notes again (anything you already added is kept, nothing is deleted).
- New switch *Settings → Omni Calendar → Tasks → Tasks on events*: turn it off if you don't want tasks inside events.
  The event's Tasks section, *Add task…* and the "2/5" progress disappear; the tasks stay in your lists. *Track as task* stays.
- New *Settings → Omni Calendar → Tasks → Automatic lists*: hide the automatic lists you don't use (e.g. *Tomorrow* or
  *No date*), so the list bar gets shorter. No tasks change.

## Known bugs

- *(none right now)*

## Released

Details of earlier versions are in the GitHub releases and pull requests. Recent highlights:

- **1.9.3** – *Create note* for tasks and subtasks (right-click menu, task dialog, details view), with its own task note
  template; short descriptions and linked notes for subtasks (≡ button in the dialog, grey text and chips in the details
  view, small icons in the lists). New switch *Tasks → Create note and subtask details* hides all of it (deletes nothing).
- **1.9.2** – Progress log for tasks: dated updates in a task's details view (Enter or the send button), added at the
  bottom, can be corrected (original time kept) or deleted; "📝 3" in the lists. New setting *Tasks → Progress log* hides it
  (deletes nothing).
- **1.9.1** – Setting *Language of dates* (follows Obsidian's language by default); the Microsoft sign-in dialog says
  which sign-in page opens; a cleaner sign-in guide with a troubleshooting section, incl. company accounts that need
  an admin's approval.
- **1.9.0** – Details view for events and tasks: clicking opens a read-only view with quick actions and *Edit notes*;
  *Edit* opens the dialog. New setting *Clicking an event or task opens* (details or edit dialog).
- **1.8.5** – Tracked events show their tasks' progress and ask about open tasks when ticked off; the Tasks list bar
  in the sidebar and the settings tab bar scroll with a thin scrollbar and the mouse wheel on desktop.
- **1.8.4** – Change how long an event lasts by dragging its top or bottom edge in the week and day views (also into
  another day, and with the finger). New *Track as task* switch for events: the event shows up in your task lists to
  tick it off, gets a tick circle in the calendar and is struck through when done (off by default; not yet for repeats).
- **1.8.3** – Timed events over several days stay in the hour grid (one block per day) instead of the all-day row;
  new setting *Events over several days* to show them in the all-day row with their whole span.
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
