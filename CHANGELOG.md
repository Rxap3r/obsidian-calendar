# Changelog

Fixes and small changes are made on `dev-branch` right away and listed under **Not released yet**.
They are released together when the maintainer asks for a release. At that point the section becomes the new version.
Bugs that are known but not fixed yet are listed under **Known bugs**, so nothing gets lost between sessions.

## Not released yet (next version: 1.7.7)

- **Month view shows start and end time** of timed events, e.g. *10:00–11:30*. Events over midnight show
  *22:00 →* on the first day and *→ 02:00* on the last. On phones and in narrow views, times in month chips stay
  hidden to save space.

- **Settings tab bar on desktop:** the ‹ › arrows no longer show up when all tabs fit, and when they are needed
  (narrow window, phone) they sit beside the tabs instead of covering them.

- **Dragging events in the week/day view lands where you see it.** The event used to be placed with its *start* at
  the mouse position, so grabbing it in the middle moved it too far. Now a preview block in the event's colour shows
  exactly where it will land, with the new time (e.g. *14:15 – 15:45*), snapping to the nearest 15 minutes.

- **Repeating events that started many years ago keep showing up.** A daily event used to disappear after about
  13 years (5000 repeats). Long-running series are also no longer counted through from their first day on every redraw.

- **"Refresh external calendars" command** now says when some calendars failed, like the refresh button in the
  calendar toolbar already did.

- **Deleting a local calendar with events** asks in the plugin's own dialog instead of the browser's box,
  like every other question does.

- **Sidebar setting keeps following the sidebar** even after a "Move to sidebar" that failed halfway. Before, it
  stopped following manual changes until Obsidian was restarted.

- **Internal clean-up, nothing looks different:** the largest files were split into smaller ones by topic and
  repeated code was merged (see the Architecture table in `CLAUDE.md`). The automatic check on GitHub now also
  runs the tests, and the code check is stricter.

## Known bugs

- *(none right now)*

## Released

Details of earlier versions are in the GitHub releases and pull requests. Recent highlights:

- **1.7.6** – All-day events created late in the evening no longer cover two days.
- **1.7.5** – Completed tasks: recent only, *Show older*, *Clear completed*, optional automatic clean-up;
  *Custom…* periods; the same standard choices in every period setting.
- **1.7.4** – The keyboard closes when tapping buttons after typing; *Upcoming* range setting for tasks.
- **1.7.3** – Date/time pickers no longer jump to the title field.
- **1.7.2** – Own date and time pickers, the same on every device.
- **1.7.1** – Task dialog fixes for phones, round checkboxes, open the Tasks page from the sidebar.
- **1.7.0** – Tasks: Tasks page, lists, priorities, time ranges, subtasks, linked notes.
