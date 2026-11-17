# Changelog

Fixes and small changes are made on `dev-branch` right away and listed under **Not released yet**.
They are released together when the maintainer asks for a release. At that point the section becomes the new version.
Bugs that are known but not fixed yet are listed under **Known bugs**, so nothing gets lost between sessions.

## Not released yet (1.9.3)

- **Create note for tasks:** right-click a task, or use the button in the task dialog or the details view, to make a
  note for it (named "YYYY-MM-DD Task"). It's linked to the task and opened; if it already exists, it just opens.
- **Notes and short descriptions for subtasks:** in the task dialog, the small ≡ button next to a subtask opens its
  description and its own linked notes (with *Create note*). The details view shows the description in small grey text
  and the notes as chips, with a ⋯ button for *Create note* / *Link note*. The task lists only show small icons.
- New setting *Settings → Omni Calendar → Notes → Task note template* for the text of new task notes.
- New switch *Settings → Omni Calendar → Tasks → Create note and subtask details* to hide all of the above if it's
  confusing. Turning it off deletes nothing.

## Known bugs

- *(none right now)*

## Released

Details of earlier versions are in the GitHub releases and pull requests. Recent highlights:

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
