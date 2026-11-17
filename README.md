# Omni Calendar for Obsidian

A calendar for Obsidian that you can open as a full page or keep in the sidebar. It has three views, with the same names everywhere (menus, settings, tab titles): the **Calendar** (full page), the **Mini calendar** and the **Day planner** (both in the sidebar). You can create events
directly in Obsidian, and you can show events from **Google Calendar, Outlook / Microsoft 365, Proton
Calendar, iCloud** or any other calendar that offers an ICS link.

- 📅 **Calendar** (full page) with **Month**, **Week**, **Day** and **Agenda** views
- 🗂 **Mini calendar** in the sidebar with event dots, the selected day's events and an "Upcoming" list
- ✍️ **Create, edit, duplicate and delete events** inside Obsidian, including all-day, multi-day and recurring events (daily / weekly / monthly / yearly)
- 🖱 **Drag to create** a time range in week/day view. **Drag and drop** events to move them
- 🔄 **Two-way Google Calendar & Outlook / Microsoft 365**: one-click sign-in, then create, edit, move and delete events from Obsidian. Your sign-in stays on your device
- 🌐 **External calendars (read-only)**: subscribe to ICS / iCal links from Google, Outlook, Proton, iCloud, Fastmail, Nextcloud and others. Recurring events, exceptions and time zones are supported
- 📝 **Notes for events**: create a note from any event using a template you can change. Local events stay linked to their note
- 🎨 Several local calendars, each with its own colour, and a filter to show or hide calendars
- ☑️ **Tasks** (new in 1.7): your own to-do lists with priorities, dates, time blocks, subtasks and linked notes, on a separate **Tasks** page or in the sidebar
- 📋 **Embed an agenda in any note** with an `omni-calendar` code block
- 📤 **Export** your local events to an `.ics` file, which you can import into Google, Outlook or Proton
- 📱 Works on desktop and mobile. It follows your light/dark theme

### Quick start

1. Install with **BRAT**: add `rxap3r/omni-calendar` ([details](#installation-with-brat-beta)).
2. Click the 📅 icon in the left ribbon to open the calendar. Double-click a day, or click **+ New**, to create an event.
3. Optional: in *Settings → Omni Calendar → **Google & Outlook***, click **Connect** to see and edit your Google / Outlook events.

### Contents

- [Installation](#installation-with-brat-beta)
- [Using the calendar](#using-the-calendar): views, sidebar, creating events, notes, agenda in notes
- [Tasks](#tasks): lists, priorities, subtasks, linked notes
- [Which connection method should I use?](#which-connection-method-should-i-use)
- [Google & Outlook (two-way)](#two-way-sync-with-google-calendar-and-outlook--microsoft-365): sign-in, own app registration, editing, security
  - [Troubleshooting sign-in](#troubleshooting-sign-in): error messages, company accounts that need an admin's approval
- [Read-only ICS subscriptions](#read-only-subscriptions-via-ics-link-proton-icloud-google-outlook-) (Proton, iCloud, …)
- [Settings](#settings-reference) · [Commands](#commands) · [Where data is stored](#where-data-is-stored)
- [Development & releases](#development) · [Changelog](CHANGELOG.md) · [Roadmap](#roadmap-ideas)

---

## Installation with BRAT (beta)

1. Install **BRAT** ("Obsidian42 - BRAT") from *Settings → Community plugins → Browse*, then enable it.
2. Open *Settings → BRAT → "Add Beta plugin"* (or run the command **BRAT: Add a beta plugin for testing**).
3. Enter the repository: `rxap3r/omni-calendar`
4. Click **Add Plugin**. BRAT downloads the latest release.
5. Enable **Omni Calendar** under *Settings → Community plugins*.

BRAT checks for updates automatically. You can also run **BRAT: Check for updates to all beta plugins**.

> **Renamed in 1.0.1:** this plugin was first released as "Calendar Hub" (ID `calendar-hub`). That ID already belongs to a
> different plugin in the community store, so Obsidian confused the two. If you installed 1.0.0, uninstall it, delete
> `.obsidian/plugins/calendar-hub/`, and add the plugin through BRAT again. Before deleting, copy `data.json` from the old folder to
> `.obsidian/plugins/omni-calendar/` if you want to keep events you already created.

### Manual installation

Download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/rxap3r/omni-calendar/releases) and put them in
`<your vault>/.obsidian/plugins/omni-calendar/`. Then reload Obsidian and enable the plugin.

---

## Using the calendar

### Opening it

| How | What it opens |
| --- | --- |
| Ribbon icon 📅 "Omni Calendar" (left bar), **click** (desktop) | The calendar (full page) in the main area |
| Ribbon icon 📅, **right-click** (desktop) or **tap** (mobile) | Menu: open calendar, show/hide the mini calendar or the day planner in the sidebar, new event, settings |
| Command **Calendar menu** | The same menu. Handy for the mobile toolbar (*Settings → Mobile → Manage toolbar options*) or a hotkey |
| Command **Omni Calendar: Open calendar** | The calendar (full page) in the main area |
| Command **Toggle mini calendar in sidebar** | Shows the mini calendar in the sidebar, or hides it if it's already there |
| Command **Toggle day planner in sidebar** | The same for the **day planner**: the calendar in the sidebar, opening in Day view as a timeline next to your notes. Month/Week/Agenda are one tap away, and the view you pick there is remembered |
| Commands **Open month / week / day / agenda view** | The calendar in that view |
| Button ⤢ / ⇥ in the calendar's toolbar | In the day planner: **open the calendar** (full page). The sidebar then switches to the mini calendar, or, depending on *Settings → Omni Calendar → Display → When the day planner opens the calendar*, closes or keeps the Day planner. In the main area: **move this calendar to the sidebar** |

You never have to drag anything. *Open calendar* always opens in the main area, even if a calendar already sits in a sidebar.

**Calendar in the sidebar:** in *Settings → Omni Calendar → **Display** → **Calendar in sidebar***, choose **Off / Mini calendar / Day planner** and the **side**
(left or right). Changes apply **immediately** and are restored every time Obsidian starts. The toggle commands and the ribbon
right-click menu change the same setting. If you close the sidebar calendar yourself (or drag it somewhere else), the setting
follows, so it never pops back unexpectedly. Commands can be given hotkeys in *Settings → Hotkeys* (search for "Omni Calendar").

### Calendar (full page)

- **Toolbar:** `‹ Today ›` navigates. *Month / Week / Day / Agenda* switches the view. The filter icon shows or hides individual calendars. ⟳ re-downloads external calendars. **+ New** creates an event.
- **Month view:** events show their **start and end time** (e.g. *10:00–11:30*). Events over midnight show *22:00 →* on the first day and *→ 02:00* on the last. Click a **day number** to open that day. **Double-click** a cell, or click the **+** that appears on hover, to create an event. When a day is full, click "+N more".
- **Week / Day view:** **click** an empty slot to create an event there. **Click and drag** to create an event covering the selected range (it snaps to 15 minutes). While you drag, a filled preview in the colour of your default calendar shows the exact start and end time. In the **week view** you can drag on into the next days, e.g. from Wednesday 12:00 to Thursday 06:00, or across several days (the preview then reads *Wed 12:00 – Thu 06:00*). The day view shows one day, so there you set a later end date in the dialog. Overlapping events are shown side by side, and a red line marks the current time. An event with a time that runs into the next day (e.g. Monday 09:00 – Tuesday 10:00) is drawn on each day it covers: *09:00 →* on the first, *→ 10:00* on the last, *→* in between. Only *All day* events go into the all-day row. If you prefer them in the all-day row, choose that in *Settings → Omni Calendar → Display → Events over several days*; they then show their whole span under the name, e.g. *Mon 09:00 – Tue 10:00*. Double-click the *all-day* row to create an all-day event.
- **On touch screens:** swipe scrolls as usual, **tap** an empty slot to create an event there, and **press and hold** (about half a second), then drag, to select a time range (also into the next day, in the week view).
- **Change the length:** drag the **bottom edge** of an event in week/day view to change when it ends, or the **top edge** to change when it starts (the pointer shows ↕). It snaps to 15 minutes and shows the new time while you drag. For an event over several days, the start is on its first day and the end on its last day; you can drag the end into another day. Works with the finger too, and for the same events as drag and drop.
- **Drag and drop:** drag a local, non-recurring event to another day (month view) or another time (week/day view) to move it. In week/day view a preview block shows exactly where the event will land, with its new time; it snaps to 15 minutes.
- **Click an event** to see its **details** (new in **1.9**): calendar, date and time, location, description, its tasks and linked notes. Nothing changes by accident; the **Edit** button opens the edit dialog. In the details you can still tick off its tasks, open or link notes, and use **Edit notes** to change only the description (saved to Google / Outlook too). Prefer the old way? *Settings → Omni Calendar → Display → Clicking an event or task opens → Edit dialog directly*. **Right-click an event** for a menu with *Show details*, *Edit*, the event's linked notes, *Create/Open note*, *Link note…*, *Add task…*, *Duplicate*, *Delete this occurrence* and *Delete*.

**Adapts to its width** (handy in a sidebar):
- In a narrow view (phone, sidebar), *Month* becomes a **compact month grid**, like phone calendar apps. Events show as small coloured bars with short titles, or as dots when it is very narrow. **Tap a day** to list its events below the grid. Tap the day heading there, or double-tap a day, to open it in Day view. *Week* still covers the **whole week** but shows only as many days as fit (e.g. 3). **Swipe left or right** (or scroll sideways, or tap the **‹ ›** arrows) to move day by day. It snaps to each day, and the hour labels stay in place. A small **week bar** under the day headers highlights which days are on screen, and a soft shadow marks the edge that continues. The arrows jump a whole week, and the view opens with today (or the chosen day) first.
- In a very wide sidebar the calendar stops growing at a comfortable width and stays centred, instead of stretching the days apart.

### Mini calendar

- Coloured dots show which days have events.
- Click a day to list its events below the calendar. Double-click a day to open it in the calendar.
- The **Upcoming** section lists the next days: hidden, tomorrow only, one of the [standard periods](#settings-reference), the same length as the agenda, or a custom period. Choose it in *Settings → Omni Calendar → Display → Upcoming list in the mini calendar*. The heading and the "Nothing planned …" text follow your choice.
- The buttons at the top are: previous/next month, today, new event, and open the calendar.

### Creating and editing events

The event dialog has these fields:

- **Title** (press `Enter` to save) and **Calendar** (which local calendar the event belongs to)
- **All day** on or off, plus **Starts** and **Ends**. If you move the start, the end moves with it so the duration stays the same.
- **Repeat:** daily, weekly, monthly or yearly, every *N* units. It can end *never*, *on a date* or *after N times*.
- **Location** and **Description**
- **Tasks** and **Linked notes** (with *Create note* / *Link note*) of an existing event, see [tasks on events](#tasks) and [notes for events](#notes-for-events)
- Buttons: **Delete this occurrence** (recurring events only), **Delete / Delete all**, **Save**

Editing a recurring event changes **every occurrence** of it. To remove a single date, use *Delete this occurrence*.

### Date and time pickers

Dates and times in the event and task dialogs use Omni Calendar's **own pickers**, so they look and work the same on Windows, Mac, Linux, Android and iOS. They don't use the device's date or clock dialogs, which differ per device and were cut off on some Android tablets.

**Date:** tap the field to get a small **month calendar**.
- **‹ ›** switch months, and today is highlighted.
- Weeks start on your *First day of the week* setting.
- **Today** is at the bottom, plus **No date** for tasks.

**Time:**

- **Click or tap the field** to get a list in **15-minute steps**, scrolled to the current or chosen time.
- **End times** list only times after the start, with the **duration**, e.g. *11:00 · 30 min*.
- **Typing on a computer:** type the time directly. `1030`, `10:30`, `9`, `930`, `2:30pm` all work; press Enter. Use this for exact minutes like 10:37.
- **On phones:** no keyboard pops up. Pick from the list, or tap **⌨ Type a time** at the top of the list.
- **No time** at the top of the list clears a task's time.
- 12 or 24 hours: *Settings → Omni Calendar → Display → 24-hour clock* (on = `14:30`, off = `2:30 PM`). The pickers, the calendar and the tasks all follow it.

### Choosing which calendars new events go to

- **Default:** *Settings → Omni Calendar → **Calendars** → **New events*** lists every calendar you can write to: your local calendars, plus the Google and Outlook
  calendars that are switched on and signed in on this device. Switch on one, several or all of them. New events are saved there by default.
- **For each event:** the *Save to* row in the event dialog shows one button per calendar, with your defaults already selected. Click a button
  to add or remove that calendar for this event only.
- **Several calendars:** the event is created in each selected calendar as a **separate copy**. Editing or deleting one copy later doesn't change the
  others. If saving fails for one calendar (e.g. you're offline), the others are still saved and you're told which one failed.

### Notes for events

Every event can have **several linked notes** (new in **1.8**). They are listed in the event dialog under *Linked notes*;
click one to open it, × removes the link (the note itself stays).
- **Link note** searches your vault. If nothing matches, you can create a new note right there.
- **Create note** makes a note named `YYYY-MM-DD Event title.md` in the notes folder (default `Calendar/`), adds it to the
  linked notes and opens it. If that note already exists, the button reads *Open note*.
- This works for **all events**: local, Google, Outlook and subscribed (ICS) ones. For Google, Outlook and ICS events the links
  are kept **only in Obsidian**; nothing is sent to Google or Microsoft.
- **Repeating events:** a note linked to one repeat (e.g. the standup on 14 Nov) belongs to that day only.
- Links follow when a note is renamed or moved, and disappear when it's deleted. Notes are never read or changed.
- Right-click an event for the same: *Open “…”* for each linked note, *Create note*, *Link note…*.
- Events from before 1.8 keep their note: it becomes the first linked note.

The note is built from a template you can change in settings. The template can use these placeholders:

`{{title}} {{date}} {{start}} {{end}} {{when}} {{location}} {{calendar}} {{description}}`
The command **Create event linked to current note** creates an event from the active note and links the two. If the note's
filename contains a date (e.g. `2026-11-20 Kickoff`), that date is used.

### Agenda inside a note

````markdown
```omni-calendar
days: 7
calendars: Personal, Work
```
````

| Option | Default | Meaning |
| --- | --- | --- |
| `days` | `7` | How many days to show |
| `date` | today | First day, as `YYYY-MM-DD` |
| `calendars` | all | Comma-separated calendar names to include |

The embedded agenda updates when events change. Click an entry to open it.

---

## Tasks

Tasks are a separate to-do system inside Omni Calendar (new in **1.7**). You create them in the plugin. Nothing is read out of your notes, but you can **link notes** to a task.

**Opening it:**
- ribbon menu → **Open tasks**, or the command **Open tasks**;
- **In the sidebar:** ribbon menu → **Show tasks in sidebar**, or *Settings → Omni Calendar → **Tasks** → Tasks in sidebar*.
  - This is independent of the mini calendar / day planner, so you can have both.
  - It uses the same side as "Calendar in sidebar".
  - The **⤢ button** at the top of the sidebar version opens the full Tasks page with the same list. The sidebar version stays where it is.

**The Tasks page:**
- **Lists on the left.** On the phone and in the sidebar, they become a bar at the top that you swipe sideways. On desktop, use the thin scrollbar under it or the mouse wheel.
  - **Today:** due today, plus anything overdue.
  - **Tomorrow.**
  - **Upcoming:** today and the next days, one heading per day. It covers 7 days by default; change it in *Settings → Omni Calendar → Tasks → Upcoming list*. Later tasks are under *All*.
  - **Overdue:** only shown in the bar when something is overdue.
  - **No date.**
  - **All:** every open task, grouped by when it's due.
  - **Done.**
  - **My lists:** your own lists, e.g. *Work* or *Home*, each with a colour. "Tasks" is the default list. Click **+** next to *My lists* to add one; right-click a list (or use ⋯) to rename, recolour or delete it. Deleting a list moves its tasks to "Tasks".
- **Sorting:** inside each group, **priority** first (high → low), then **time** (tasks with a time before tasks without).
- **Quick add:** type into the field at the top and press **Enter**.
  - In *Today*, *Upcoming* and *Overdue* the task gets today's date; in *Tomorrow*, tomorrow's.
  - In your own list it goes into that list without a date.
- **+ New task** opens the full dialog.
- **Tick the circle** to complete a task. Completed tasks are struck through and move to a collapsed **Done** section (in your own lists and *All*) and to the *Done* list. You can hide that section in the settings.
- **Completed tasks don't pile up:**
  - Done shows only tasks completed in the **last 30 days** (setting). Older ones are behind **Show older**; nothing is lost.
  - **Clear completed** under the Done list (or a list's Done section) deletes completed tasks by hand, after asking.
  - **Automatic clean-up** (off by default): *Settings → Omni Calendar → Tasks → Delete completed tasks after* (Never by default, or one of the standard periods, or custom).
- **Click a task** to see its **details** (new in **1.9**): date and time, list, priority, its event, notes, subtasks and linked notes. Tick off the task or its subtasks and change the notes (**Edit notes**) right there; **Edit** opens the task dialog. (With *Edit dialog directly*, a click opens the dialog as before.) **Right-click** it for quick actions:
  - show details / edit;
  - done / not done;
  - Today / Tomorrow / Next week / No date;
  - priority;
  - delete.
- **Notes for tasks and subtasks** (new in **1.9.3**):
  - **Create note** makes a note for a task, named `YYYY-MM-DD Task title.md` (just the title when the task has no date) in
    the notes folder. It's added to the task's linked notes and opened; once it exists, the button says **Open note**.
    You find it in the task's right-click menu, in the task dialog (*Linked notes*) and in the details view.
  - **Subtasks** can have their own notes and a **short description** (a line or two; longer things belong in a note).
    In the task dialog, the small **≡** button next to a subtask opens its description, its linked notes and *Create note*
    (named `YYYY-MM-DD Task – Subtask.md`). In the details view, the description is shown in small grey text under the
    subtask, its notes as small chips, and the **⋯** button offers *Create note*, *Link note…* and removing a link.
    In the task lists you only see small icons: ≡ for a description, a note icon that opens the subtask's note.
  - The text of new task notes comes from *Settings → Omni Calendar → Notes → Task note template*.
  - Don't need all of it? Two switches in *Settings → Omni Calendar → Tasks*:
    - **Create note for tasks** – the main switch. Off hides *Create note* on tasks **and** everything on subtasks.
    - **Notes and descriptions on subtasks** (shown under it) – **off by default**, so subtasks stay plain: no ≡ button,
      description, subtask notes or ⋯, while tasks keep *Create note*. Turn it on to use the subtask part described above.

    Turning them off deletes nothing; the task's own linked notes stay.
- **Progress log** (new in **1.9.2**): in a task's details there's a **Progress log** section. Type what you did or what
  happened and press **Enter** (on a phone: the send button). Each entry is saved with its **date and time**, like a sticky
  note; new entries go **below** the older ones, so the history reads top to bottom. It's separate from subtasks: subtasks
  are things *to do*, the log records what was *done*.
  - Correct an entry with the **pencil** (its original time stays, it's marked *edited*), or delete it with the **bin** (asks first).
  - Tasks with entries show **📝 3** (the number of entries) in the task lists.
  - Don't need it? *Settings → Omni Calendar → Tasks → Progress log* hides it everywhere. Turning it off deletes nothing.
- **Shown under each task:** the time or time range (e.g. *10:30–11:45*), the list (when you have more than one), subtask progress (*1/3*, click to show or hide the subtasks), and **linked notes** as small chips that open the note.

**The task dialog:**
- **Title, list and priority:** *None / Low / Medium / High*, shown as `!`, `!!`, `!!!`.
- **Date:** with quick buttons *Today*, *Tomorrow*, *Next week* and *No date*.
- **Time:** optional, once a date is set. Either a single time or a range (*from … to …*). See [date and time pickers](#date-and-time-pickers).
- **Subtasks:** one level. Type and press Enter to add one. You can also tick them off directly on the Tasks page.
- **Linked notes:**
  - **Link note** searches your vault, and you can link as many notes as you like.
  - If no note matches, you can create a new one; it goes into your notes folder (*Notes* tab).
  - Links follow when a note is renamed or moved, and disappear when it's deleted. The notes themselves are never changed.
- **Notes:** free text for the task.

**Tasks on events** (new in **1.8**):
- The event dialog has a **Tasks** section: type a task and press **Enter**, tick it off right there, click it to edit it.
  Right-click an event → **Add task…** does the same.
- A task's **subtasks** are listed under it in the event dialog and can be ticked off there; click the count (*1/3*) to fold them away.
- The event then shows the progress, e.g. **☐ 2/5**, in the month, week, day and agenda views and in the mini calendar.
- A new event task gets the event's day as its date, so it also shows up in *Today*, *Upcoming* and so on.
  In the task lists it shows the event's name; **click the name** to open the event. In the task dialog, the unlink button
  next to *Event* detaches the task (the task stays).
- Works for local, **Google, Outlook and subscribed (ICS)** events. These tasks are kept **only in Obsidian**.
- On a **repeating event**, tasks belong to the repeat you clicked (e.g. only the meeting on 14 Nov).
  Tasks that repeat with the event are planned for 1.10.
- **A new event** can get its tasks (and linked notes) right away in its dialog. They are attached when you click
  *Save*; *Cancel* forgets them. Saved to several calendars, they go with **one** copy, the first calendar in *Save to*
  (the dialog says which). A new repeating event gets them on its first repeat. *Create note* is offered once the event is saved.
- **Tasks move with their event:** when the event moves to another day (dialog, drag, or in Google/Outlook), its tasks
  move by the same number of days, so they stay on (or the same distance before) the event. Times are kept.
- **Deleting an event deletes its tasks**, after asking (deleting one repeat deletes only that repeat's tasks).
  Moving an event to another calendar keeps its tasks and linked notes.
- If an event disappears some other way (e.g. deleted in Google Calendar), its tasks show the event name crossed out
  (for local events) or say it can't be found. Clicking the name lets you keep the task without the event, or delete it.

**Track an event as a task** (new in **1.8.4**):
- Sometimes an event itself is something to tick off. Switch on **Track as task** in the event dialog (also when creating
  it), or right-click the event → **Track as task**. It's **off by default**, so your task lists don't fill up with every event.
- The event then shows up in your task lists (*Today*, *Upcoming*, …) with its time and the mark *Event*. Tick it off there.
  Clicking it opens the event, because its name, day and time belong to the event and follow it when it changes.
- In the calendar it isn't shown twice: the event gets a small **tick circle**; ticked off, it's **struck through**.
- If the event has tasks of its own, its row in the task lists shows their progress (*☐ 2/5*). They stay separate tasks,
  because they often have their own day. When you tick off the event while some are still open, you're asked whether to
  mark them as done too (*Only the event* / *Mark all as done*).
- Works for local, Google, Outlook and ICS events; the "done" mark is kept only in Obsidian. Deleting the event removes it.
- Not yet for repeating events (each repeat ticked off separately comes with 1.10). Switch it off again in the dialog or with
  right-click → *Stop tracking as task*.

**Tasks in the calendar** (new in **1.8**):
- **Tasks with a time** appear in *Week* and *Day* as **light, dashed blocks** with a tick circle, next to the events.
  A single time (e.g. *15:00*) is drawn half an hour long.
  - Tick the circle to complete the task; click the block to edit it; right-click for the task menu.
  - **Drag** a task block to another time or day; it keeps its length. Dropped on the *all-day* row, it keeps only the date.
- **Tasks with only a date** don't get their own entries. Each day shows **one small counter** (☐ 3) with the number of open tasks.
  **Tap it** to see the day's tasks, tick them off, or add one for that day.
- **Month view:** one small counter per day for all of the day's tasks. On the phone, days with open tasks get a tiny mark,
  and the counter is next to the selected day. The **agenda** shows the counter next to each day.
- Tasks that belong to an event and have no time are not counted there: the event shows them (☐ 2/5).
- Completed tasks are **struck through**, or hidden with *Settings → Omni Calendar → Tasks → Completed tasks in the calendar*.
- *Settings → Omni Calendar → Tasks → Tasks in the calendar* turns all of this off.

**Tasks today in the mini calendar** (new in **1.8**): below the selected day, a short list of tasks due today and overdue
ones (marked *overdue*), plus what you ticked off today (struck through). Tick them off right there; **+** adds a task for today;
the heading opens the Tasks page. Turn it off in *Settings → Omni Calendar → Tasks → Tasks today in the mini calendar*.

**Turning tasks off:** *Settings → Omni Calendar → Tasks → Use tasks*. When it's off, the Tasks page, its menu entries and commands disappear. Your tasks are kept.

Tasks are stored with your local events in the plugin's `data.json`, so they sync the same way (see [Where data is stored](#where-data-is-stored)).

Coming next (see the [roadmap](#roadmap-ideas)):
- **1.10:** repeating tasks, and tasks on repeating events that repeat with them.

## Which connection method should I use?

Omni Calendar has three ways to get events in. Pick by what you want to do and how much setup you're willing to do:

| Method | Works with | Read | Write | What you need | Setup time | Cost |
| --- | --- | :-: | :-: | --- | --- | --- |
| **Local calendar** | Obsidian only | ✅ | ✅ | Nothing. Works out of the box | 0 min | Free |
| **ICS link** (subscription) | Google, Outlook (personal & work), Proton, iCloud, Fastmail, Nextcloud, … | ✅ | ❌ | The calendar's private/secret ICS link | 2 min | Free |
| **Google account** (two-way) | Google Calendar (Gmail; Workspace if your admin allows it) | ✅ | ✅ | Nothing. Just click *Sign in with Google* (built-in app). Google shows an "unverified app" warning for now | 1 min | Free |
| **Microsoft account** (two-way) | Outlook.com, Hotmail, Live and work/school Microsoft 365 | ✅ | ✅ | Nothing. Just click *Sign in with Microsoft* (built-in app). Work/school accounts may need IT approval | 1 min | Free |
| **Proton Calendar** | Proton | ✅ (ICS link) | ❌ | Proton offers no way for apps to write. Use the ICS link to read, and *Export local events to .ics* plus Proton's *Import* to copy events over | 2 min | Free |

**Quick advice**

- You only want to **see** your Google, Outlook or Proton events in Obsidian → use an **ICS link**. It's the fastest and works on every device without signing in.
- You want to **create or change** Google or Outlook events from Obsidian → connect the **account** (two-way). No setup is needed.
- Outlook / Microsoft 365 → just **sign in**. No setup is needed.

Two-way accounts need **Obsidian 1.11.4 or newer**, because sign-in tokens are kept in Obsidian's secure storage.

---

## Two-way sync with Google Calendar and Outlook / Microsoft 365

Connect an account in *Settings → Omni Calendar → **Google & Outlook***. The account's calendars then appear in
Omni Calendar. In calendars you can write to, you can **create, edit, move (drag & drop) and delete** events, and every change
is saved straight to Google or Outlook. Calendars shared with you read-only (e.g. holidays) are shown but can't be edited.

### Microsoft (Outlook.com, Hotmail, Live, Microsoft 365): just sign in

1. *Settings → Omni Calendar → **Google & Outlook** → **Connect Outlook / Microsoft 365***. Leave *How do you want to connect?* on **Quick sign-in (recommended)**.
2. Click **Sign in with Microsoft**, sign in with your account in the browser and click **Accept**.
3. Back in Obsidian, switch on the calendars you want to see.

This uses Omni Calendar's built-in Microsoft app registration, so you don't need an Azure account or any setup. Its client ID is public by design (every
desktop app's ID is). It gives the plugin no access by itself: access only exists through the sign-in that happens on *your* device, with
PKCE, and the tokens stay on that device. No Omni Calendar server is involved.

**What you'll see:** Microsoft asks you to allow *Omni Calendar* to **read and write your calendars** and to **keep access** (so you stay signed in).
It asks for nothing else: no e-mail, contacts or files. The app may be marked **"unverified"**. That only means the publisher hasn't done Microsoft's
partner verification, and the sign-in itself is Microsoft's standard sign-in.

**Work or school account?** Many organisations don't let employees approve apps themselves. If you see *"Need admin approval"*, see
[Company or school accounts](#company-or-school-accounts-approval-and-company-rules).

### Google: just sign in

1. *Settings → Omni Calendar → **Google & Outlook** → **Connect Google***. Leave *How do you want to connect?* on **Quick sign-in (recommended)**.
2. Click **Sign in with Google** and choose your account.
3. Google shows **"Google hasn't verified this app"**. Click **Advanced → Go to Omni Calendar (unsafe)**. This is Google's standard text for apps that
   haven't completed Google's review yet. The sign-in itself is Google's normal sign-in.
4. Allow Omni Calendar to **view and edit events** in your calendars and to **see your list of calendars**. Tick both boxes, then click *Continue*.
5. Back in Obsidian, switch on the calendars you want to see.

**Good to know**
- Until Google verifies Omni Calendar, the built-in app is limited to **100 users** in total. If Google refuses sign-in for that reason, use your own app registration (Method A below).
- Google Workspace (work/school) administrators may block unverified apps.
- To remove access, use Omni Calendar → *Sign out*, which revokes it at Google, or [myaccount.google.com → Security → Third-party connections](https://myaccount.google.com/connections).
- The built-in client ID and client secret are public by design. For desktop apps Google documents the "client secret" as not confidential. On their own they give no access to anyone's calendar.

### Optional: your own app registration

Omni Calendar has **no central server**. If you prefer, you can register a small app of your own, so that only you, your devices and
Google/Microsoft are involved. You do this once per account; other devices then sign in with the same Client ID.
The same steps are shown in the sign-in dialog (*Use my own app registration (advanced)*).

**Which method?**

| Your account | Method | Time |
| --- | --- | --- |
| Google (Gmail or Workspace) | **A** | 10–15 min |
| Microsoft **work or school** (Microsoft 365) | **B** | ~10 min |
| Microsoft **personal** (Outlook.com, Hotmail, Live) | **C** | 20–30 min |

Click a method to expand it. If something goes wrong, see [Troubleshooting sign-in](#troubleshooting-sign-in).

<details>
<summary><b>Method A: own Google app</b></summary>

**You need**
- A Google account. Personal Gmail works; with a Google Workspace (work/school) account, your admin may block self-made apps.
- A desktop computer for the setup.
- No credit card and no billing account. The Google Calendar API is free for this kind of personal use.

**Steps**

1. Open [console.cloud.google.com](https://console.cloud.google.com) and sign in. Create a **new project** (top bar → project picker → *New project*, any name such as "Obsidian Calendar").
2. *APIs & Services → Library* → search **Google Calendar API** → **Enable**.
3. *Google Auth Platform* (formerly *OAuth consent screen*) → *Get started*:
   - App name: anything (e.g. "My Obsidian Calendar"). Support and contact e-mail: your address.
   - Audience: **External**.
   - Under **Audience**, click **Publish app** (status "In production"). Otherwise Google signs you out every 7 days. You don't need to submit it for verification.
4. *Clients* (or *Credentials*) → **Create client** → application type **Desktop app** → *Create*.
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) and the **Client secret** (starts with `GOCSPX-`).
6. In Obsidian: *Settings → Omni Calendar → **Google & Outlook** → **Connect Google*** → *Use my own app registration (advanced)*. Paste both values and click **Sign in with Google**.
7. In the browser, choose your account. Google shows **"Google hasn't verified this app"**. That's expected, because the app is your own: click *Advanced → Go to (your app name)*, then **Allow**.
8. Back in Obsidian, switch on the calendars you want to see.

</details>

<details>
<summary><b>Method B: own Microsoft app for a work or school account</b></summary>

**You need**
- A work or school Microsoft 365 account.
- Permission to register apps in your organisation. Most organisations allow it. If *New registration* is greyed out or forbidden, ask your IT team to create the registration for you (steps below).
- Possibly an **admin's approval** afterwards. Many organisations require it for every app; see [Company or school accounts](#company-or-school-accounts-approval-and-company-rules).
- No client secret and no cost.

**Steps**

1. Open [entra.microsoft.com](https://entra.microsoft.com) (or [portal.azure.com](https://portal.azure.com)) with your work account → *App registrations* → **New registration**.
2. Name: anything. **Supported account types:** **Accounts in this organizational directory only** (single tenant). This is the preselected option and the recommended one: Microsoft by default doesn't let employees approve new apps that are open to *other* organisations.
3. **Redirect URI:** platform **Public client/native (mobile & desktop)**, value `http://localhost` → **Register**.
4. *API permissions* → *Add a permission* → *Microsoft Graph* → *Delegated permissions* → tick **Calendars.ReadWrite** → *Add permissions*. (Staying signed in, `offline_access`, is requested automatically.)
5. On the *Overview* page, copy the **Application (client) ID** and the **Directory (tenant) ID**.
6. In Obsidian: **Connect Outlook / Microsoft 365** → *Use my own app registration (advanced)* → *Which Microsoft account?* **Work or school – single organisation (tenant ID)** → paste both IDs → **Sign in with Microsoft**.

</details>

<details>
<summary><b>Method C: own Microsoft app for a personal account</b></summary>

Microsoft only lets you create app registrations inside a Microsoft Entra **directory (tenant)**, and a personal account doesn't have one on its own.
You get one by signing up for a free Azure account.

**You need**
- Your Outlook.com / Hotmail / Live account.
- A **free Azure account** ([azure.microsoft.com/free](https://azure.microsoft.com/free)). Microsoft asks for a phone number and a credit card to verify your identity. The app registration itself costs nothing, and you don't need any paid Azure services. Reports say it keeps working after the free trial ends, because it belongs to the directory, not the subscription; Microsoft doesn't explicitly guarantee this.
- A desktop computer for the setup.

**Steps**

1. Sign up at [azure.microsoft.com/free](https://azure.microsoft.com/free) with your Outlook.com account (skip this if you already have Azure). This creates your directory.
2. Open [portal.azure.com](https://portal.azure.com) → search **App registrations** → **New registration**.
3. Name: anything. **Supported account types:** **Personal Microsoft accounts only** (or *Accounts in any organizational directory and personal Microsoft accounts*). ⚠️ This is **not** the preselected option, and changing it later is fiddly.
4. **Redirect URI:** platform **Public client/native (mobile & desktop)**, value `http://localhost` → **Register**.
5. *API permissions* → *Add a permission* → *Microsoft Graph* → *Delegated* → **Calendars.ReadWrite** → *Add permissions*.
6. Copy the **Application (client) ID** from the *Overview* page.
7. In Obsidian: **Connect Outlook / Microsoft 365** → *Use my own app registration (advanced)* → *Which Microsoft account?* **Personal** → paste the client ID → **Sign in with Microsoft** → sign in with your Outlook.com account and **Accept**.

</details>

### Signing in on mobile and on other devices

Your browser opens, you sign in there and approve access, and Obsidian picks up the result automatically. On **mobile**, or if the browser
can't hand the result back, the browser ends on a "can't connect to localhost" page. That's expected: copy that page's full address
and paste it into the sign-in dialog.

Sign-in tokens stay on the device, so **each device signs in once**, with the same Client ID (and, for Google, the same Client secret).
After signing in, switch on the calendars you want to see. The primary calendar is on by default.

### Troubleshooting sign-in

#### Google

| You see | What's wrong | What to do |
| --- | --- | --- |
| *"Access blocked: app has not completed verification"* | Your own app isn't published | Method A, step 3: *Publish app* |
| Signed out again after a week | Your own app is still in "Testing" | Method A, step 3: *Publish app* |
| *"Error 403: org_internal"*, or blocked by your admin | Your Workspace administrator doesn't allow the app | Ask your admin, or use an [ICS link](#read-only-subscriptions-via-ics-link-proton-icloud-google-outlook-) to see the calendar |
| Sign-in refused, mentioning the user limit | The built-in app is limited to 100 users until Google verifies it | Use your own app (Method A) |

#### Microsoft: error messages

These come up with your own app registration (Methods B and C). The code (`AADSTS…`) is shown in the browser after signing in.

| You see | What's wrong | What to do |
| --- | --- | --- |
| A sign-in page for the **wrong kind of account** (personal instead of company, or the other way round) | *Which Microsoft account?* in the sign-in dialog doesn't match your account. *Personal* is preselected | Choose the right type in the dialog. The dialog says which sign-in page will open |
| *unauthorized_client* ("not enabled for consumers") with a personal account | The app doesn't allow personal accounts (*Supported account types* left at its default) | Easiest: create a **new** app registration with *Personal Microsoft accounts only* (Method C, step 3) |
| *"Property api.requestedAccessTokenVersion is invalid"* when allowing personal accounts on an existing app | Azure needs one manifest setting changed first | App → **Manifest** → in the `"api"` section change `"requestedAccessTokenVersion": null` to `2` → *Save* → change the account types again under *Authentication*. Or create a new app registration |
| *AADSTS50020* "account does not exist in tenant" | The app doesn't allow this kind of account | Change *Supported account types* (*Authentication*), or create a new app registration |
| *AADSTS700016* "Application … was not found in the directory" | Wrong or incomplete client ID, or the account type in Obsidian doesn't match the app | Copy the whole *Application (client) ID* again; check *Which Microsoft account?* |
| *AADSTS50194* "not configured as a multi-tenant application" | A single-organisation app, but Obsidian isn't using its tenant ID | Choose **Work or school – single organisation (tenant ID)** and enter the *Directory (tenant) ID* |
| *AADSTS50011* "redirect URI … does not match" | The redirect address differs | It must be exactly `http://localhost` (not `https`, not `127.0.0.1`, no `/` at the end) |
| *AADSTS7000218* "must contain client_assertion or client_secret" | The redirect address was added under platform **Web** | *Authentication*: remove it under *Web*, then *Add a platform* → **Mobile and desktop applications** → `http://localhost` |
| *unauthorized_client* even though personal accounts are allowed | The redirect address is under the wrong platform | As in the row above |
| *"You can't create app registrations"*, or no directory shown (personal) | The Azure sign-up isn't finished | Method C, step 1 |
| *"Need admin approval"*, a *"request approval"* button, or *AADSTS65001* | Your organisation requires an admin to approve the app | See the next section |

#### Company or school accounts: approval and company rules

Every organisation decides whether employees may approve apps themselves. Many don't allow it, or only for apps from "verified publishers". Since 2025
Microsoft's default also blocks employees from approving new apps that are open to *other* organisations (multi-tenant). In both cases sign-in works,
but Microsoft then asks for an **admin's approval**. Omni Calendar can't change this, and doesn't try to get around it.

Try these in order:

1. **Use a single-organisation app** (Method B): *Supported account types* **Accounts in this organizational directory only**, and in Obsidian
   **Work or school – single organisation (tenant ID)** with the *Directory (tenant) ID*. This is enough if your organisation only blocks multi-tenant apps.
2. **Still asked for approval?** Then it's your organisation's policy. Someone with admin rights (e.g. *Global Administrator*, *Privileged Role
   Administrator* or *Cloud Application Administrator*) approves the app **once**: Entra → *App registrations* → your app → *API permissions* →
   **Grant admin consent for …**. The *request approval* button in the sign-in page sends this request to your admins, if your organisation has turned that on.
3. **Asking IT?** Tell them what the app needs, for example:
   > I'd like to connect my work calendar to a calendar tool on my computer (Omni Calendar for Obsidian). I created an app registration in our
   > directory: *[app name]*, client ID *[Application (client) ID]*. It only needs the delegated permissions **Calendars.ReadWrite** (my own
   > calendars; no mail, files or contacts) and **offline_access** (stay signed in). It has no client secret and only accepts accounts from our
   > organisation. Could you grant admin consent for it (Entra → App registrations → the app → API permissions → "Grant admin consent")?

   *Quick sign-in* runs into the same rule: for company accounts, the built-in app also needs an admin's approval.

**If IT says no**, you can still **see** your work calendar, read-only:

- **ICS link:** Outlook on the web → *Settings → Calendar → Shared calendars → Publish a calendar* → copy the ICS link →
  [add it as a subscription](#read-only-subscriptions-via-ics-link-proton-icloud-google-outlook-). Many organisations switch publishing off.
- **Calendar file in your vault**, if publishing is off: in **classic Outlook for Windows**, open the calendar → *File → Save Calendar* → choose a date range
  (e.g. the next 3 months) and *Full details* → save it as e.g. `work.ics` **inside your vault**. Then *Settings → Omni Calendar → Calendars →
  Add subscription* with the file's path, e.g. `Calendar/work.ics`. It's a snapshot: save the file again over the old one and press ⟳ to update it.
  The new Outlook and Outlook on the web can't export like this. Check that exporting calendar data is allowed in your organisation.

### How editing works

- **New events:** pick a Google or Outlook calendar in the event dialog's *Calendar* field. Repeating events are supported (daily, weekly, monthly or yearly).
- **Edit or delete:** click an event. For repeating events, changes and *Delete this occurrence* apply to the clicked occurrence. *Delete series* removes all occurrences. To change the repeat rule itself, use Google or Outlook.
- **Move:** drag single (non-repeating) events, or choose another calendar in the dialog. Moving between calendars creates the event in the new calendar, then deletes the original.
- **Conflict protection:** each edit or delete only goes through if the event hasn't been changed elsewhere since it was loaded (ETag check). If it has, nothing is overwritten. The event is reloaded and you're asked to try again.
- **Deletes** always ask for confirmation.
- Events from 6 months back to 18 months ahead are loaded, at start-up, every refresh interval, and after each change you make.

### Security

| | |
| --- | --- |
| **Sign-in** | OAuth 2.0 authorization code flow with **PKCE** and a random `state` check (RFC 8252, recommended for desktop and mobile apps). You sign in on the real Google or Microsoft page in your own browser, so Omni Calendar never sees your password or 2FA. |
| **Redirect** | The sign-in result comes back to a one-time web server that only accepts connections from your own computer (loopback `127.0.0.1` / `localhost`), not from the network. It accepts exactly one valid response, rejects anything with a wrong `state`, and shuts down straight away or after 5 minutes. |
| **No middleman** | No Omni Calendar server exists. With the built-in apps or your own registration, requests go only to `accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com`, `login.microsoftonline.com` and `graph.microsoft.com`, always over HTTPS. The plugin refuses to send a token to any other host. |
| **Token storage** | The refresh token, and Google's client secret, are kept only in **Obsidian's secure storage** (SecretStorage, Obsidian 1.11.4+) **on this device**. They are never written to `data.json`, your vault or your sync, and never to logs or error messages. Access tokens are kept only in memory and expire after about an hour. Each device signs in separately. |
| **Least privilege** | Google: `calendar.events` and `calendar.calendarlist.readonly`. Microsoft: `Calendars.ReadWrite` and `offline_access`. No access to e-mail, contacts, files or your profile. |
| **Event data** | Events from connected accounts are kept in memory only, not cached to disk. |
| **Sign out** | *Sign out* deletes the token from this device. For Google it also revokes access at Google. For Microsoft, you can also remove the app at [account.microsoft.com → Privacy → Apps and services](https://account.microsoft.com/privacy/app-access) (personal accounts) or [myapps.microsoft.com](https://myapps.microsoft.com) (work accounts). *Remove account* also deletes the stored client secret. |

> Connecting accounts needs **Obsidian 1.11.4 or newer**. Older versions have no secure storage, and Omni Calendar won't store tokens anywhere else.

---

## Read-only subscriptions via ICS link (Proton, iCloud, Google, Outlook, …)

**You need:** access to your calendar's settings on the provider's website, to copy its private ICS link. No sign-in, no app registration,
and it works on every device including mobile. **Limits:** read-only, and some providers update the ICS feed with a delay
(from a few minutes up to several hours), so very recent changes can take a while to appear.

Go to *Settings → Omni Calendar → **Calendars** → **Add subscription***. Give it a name and colour, and paste the calendar's
**ICS link**. The calendar is downloaded at startup, then every *N* minutes (default 30), and whenever you press ⟳.
The last download is stored in the plugin folder, so events still show when you are offline.

| Provider | Where to find the ICS link |
| --- | --- |
| **Google Calendar** | calendar.google.com → ⚙ Settings → choose the calendar under *Settings for my calendars* → *Integrate calendar* → copy **Secret address in iCal format** |
| **Outlook / Microsoft 365** | Outlook on the web → ⚙ Settings → Calendar → *Shared calendars* → **Publish a calendar** → choose the calendar and *Can view all details* → Publish → copy the **ICS** link |
| **Proton Calendar** | calendar.proton.me → Settings → Calendars → choose the calendar → **Share with anyone / Create link** (full view) → copy the link |
| **Apple iCloud** | Calendar app → right-click the calendar → Share Calendar → **Public Calendar** → copy the `webcal://` link |
| Anything else | Any `https://` or `webcal://` link that returns an `.ics` file. You can also use a path to an `.ics` file in your vault, such as `Attachments/holidays.ics` |

> 🔒 **Treat these links like passwords.** Anyone who has one can read that calendar. The links are stored in
> `.obsidian/plugins/omni-calendar/data.json`. If your vault is synced or shared publicly, keep that in mind.

### Why are ICS subscriptions read-only?

ICS links can only be read. For Google and Outlook, use the two-way account connection described above.
**Proton Calendar** is end-to-end encrypted and offers no API or CalDAV access, so no app can write to it. For Proton you can:

- use **Copy to local calendar** on an event to make an editable copy in Obsidian, and
- run **Export local events to .ics file** and import that file in Proton Calendar (Settings → Import).

---

## Settings reference

The settings are split into five tabs. Longer explanations sit in collapsible **ℹ** sections.

| Tab | Setting | Description |
| --- | --- | --- |
| **Calendars** | New events | Which calendars (local, Google, Outlook – one, several or all) new events are saved to by default |
| | Local calendars | Add, rename, recolour, hide or delete calendars |
| | Subscriptions (read-only) | Name, colour, ICS URL, on/off, refresh and remove. Each shows its status (event count, last update or error) |
| | Refresh every | How often subscriptions and accounts are re-downloaded, in minutes. `0` means start-up / manual only |
| **Google & Outlook** | Accounts | Connect, reconnect, sign out, rename or remove accounts. Show or hide each of an account's calendars and set its colour and name |
| **Display** | Default view | The view used when the calendar page opens |
| | First day of the week | Sunday through Saturday |
| | Clicking an event or task opens | *Details view* (default) or *Edit dialog directly*. Right-click always offers both |
| | Language of dates | Weekday and month names: *Same as Obsidian* (default, follows *Settings → General → Language*), *Same as this device*, or *English*. The plugin's own words stay English |
| | 24-hour clock | `14:00` vs `2pm` |
| | Show week numbers | ISO week numbers in the month view, sidebar and narrow layouts |
| | Events over several days | Week/day view: timed events that run into the next day as one block per day in the hours (default), or in the all-day row with their whole span (*Mon 09:00 – Tue 10:00*) |
| | Scroll to hour | Where week/day views start. If today is visible, the view scrolls to the current time |
| | Default event length | Length of a new event, in minutes |
| | Agenda length | How many days the Agenda view shows (standard periods or custom, default 30 days) |
| | Calendar in sidebar | Off / mini calendar / day planner, and left or right side. Applied immediately and kept after restarts |
| | When the day planner opens the calendar | What ⤢ in the day planner does to the sidebar: **switch to the mini calendar** (default), close the day planner, or keep it |
| | Then show this sidebar tab | Only with *close it*: which tab of the calendar's sidebar (left or right) is shown afterwards, e.g. *Files* or *Bookmarks*. The list shows the tabs that are in that sidebar right now. *Let Obsidian decide* keeps Obsidian's choice |
| | Upcoming list in the mini calendar | How far ahead "Upcoming" looks: *Hidden*, *Tomorrow only*, the standard periods, *Same as agenda length*, or custom (up to 1 year) |
| **Tasks** | Use tasks | Main switch for everything task-related. Off hides it but deletes nothing |
| | Tasks in sidebar | Shows the Tasks page in the sidebar (same side as the calendar), independent of mini calendar / day planner |
| | Done section in lists | Collapsed "Done" section in your lists and *All* |
| | Progress log | Dated updates on a task in its details view, "📝 3" in the lists (on by default). Off only hides it |
| | Create note for tasks | *Create note* on tasks (on by default). Off also turns off the subtask part below. Only hides, deletes nothing |
| | Notes and descriptions on subtasks | Descriptions, linked notes and *Create note* on subtasks (**off** by default; shown while *Create note for tasks* is on) |
| | Upcoming list | How far ahead the "Upcoming" list looks: standard periods (default 7 days) or custom |
| | Tasks in the calendar | Timed tasks as light blocks in Week/Day, one counter per day for the others (on by default) |
| | Completed tasks in the calendar | *Struck through* (default) or *Hidden* |
| | Tasks today in the mini calendar | The "Tasks today" section in the mini calendar (on by default) |
| | Show completed tasks from the last | Done shows tasks completed in this period (default 30 days, or *Everything*); older ones behind "Show older" |
| | Delete completed tasks after | Automatic clean-up: **Never** (default), the standard periods, or custom. Deleting can't be undone |
| | Default priority / Default list | Used for new tasks |
| | Lists | Rename, recolour, add or delete task lists ("Tasks" is the default list and can't be deleted) |
| **Notes** | Notes folder / Note template | Where *Create note* puts notes, and what goes in them |
| | Task note template | What goes in notes made with *Create note* on a task or subtask (placeholders listed in the setting). Shown while *Create note for tasks* is on |

**Periods ("how long / how far" settings):** they all offer the **same standard choices**: *7 days, 2 weeks, 30 days, 60 days, 90 days, 6 months, 1 year*. A few add their own extras (*Never*, *Hidden*, *Tomorrow only*, *Everything*, *Same as agenda length*). And they all have **Custom…**. It shows a number and a unit (days, weeks, months, years), for example *2 years* or *200 days*. Values over the maximum are limited, and the field then shows the value that is used.

## Commands

- Open calendar
- Calendar menu (open, sidebar, new event, settings)
- Toggle mini calendar in sidebar / Toggle day planner in sidebar
- Show mini calendar in sidebar
- Open month / week / day / agenda view
- Create new event
- Create event linked to current note
- Refresh external calendars
- Export local events to .ics file
- Open tasks / Toggle tasks in sidebar / Create new task (only while tasks are turned on)

## Where data is stored

- **Local events, tasks and settings:** `.obsidian/plugins/omni-calendar/data.json`. Obsidian Sync and other sync tools carry them to your other devices. The plugin reloads automatically when Sync changes this file.
- **Cached ICS calendars:** `.obsidian/plugins/omni-calendar/cache/*.ics`
- **Google / Outlook:** account settings (client ID, account label, chosen calendars) are in `data.json`. Sign-in tokens and the Google client secret are **only** in Obsidian's secure storage on each device. Events are kept in memory.
- **Event notes:** ordinary Markdown files in your notes folder. Which notes are linked to which event, and the tasks of
  events, are in `data.json` (also for Google, Outlook and ICS events; nothing is stored at Google or Microsoft).

The plugin only makes network requests to the ICS URLs you configure and, for connected accounts, to Google or Microsoft.

---

## Development

```bash
npm install
npm run dev     # watch mode – builds main.js on change
npm run build   # type-check + production build
npm test        # build + automated tests (sign-in/connectors + UI in headless Chromium), see tests/README.md
```

Contributors and AI assistants: the working agreements (branching, versioning, releases, security rules) are in
[`CLAUDE.md`](CLAUDE.md).

**Built-in Google sign-in:** the Google OAuth client is not stored in the repository. The build reads it from the environment variables
`OMNI_GOOGLE_CLIENT_ID` and `OMNI_GOOGLE_CLIENT_SECRET`. The release workflow takes them from the repository secrets of the same names
(*Settings → Secrets and variables → Actions*). Without them the build still works, and Google is then connected with your own app registration.

To try it in a vault, symlink or copy the repository folder (or just `main.js`, `manifest.json`, `styles.css`) into
`<vault>/.obsidian/plugins/omni-calendar/`.

Project layout:

```
src/
  main.ts                 plugin entry: start-up, ribbon and menu, opening pages, notes
  commands.ts             commands for the command palette
  sidebar.ts              mini calendar, day planner and Tasks in the sidebar
  settingsData.ts         loading and checking data.json, migrations
  defaults.ts             default settings, colour palette
  store.ts                events: local (with repeats), ICS subscriptions, Google / Outlook
  tasks.ts                tasks and task lists
  ics.ts, icsExport.ts    ICS parsing (ical.js, time zones, repeats) and .ics export
  notes.ts                event → note creation and template
  dateUtils.ts, periods.ts, util.ts   small helpers
  sync/                   Google / Outlook sign-in and connectors
  settings/               settings window: one file per tab, shared controls
  pickers/                own date and time fields
  views/CalendarView.ts   calendar page / day planner (frame: toolbar, navigation)
  views/calendar/         month, week/day, agenda, drag & drop, tasks in the calendar
  views/eventExtras.ts    tasks and linked notes of an event (dialog + details)
  views/linkedNotes.ts    the "Linked notes" block (events and tasks)
  eventLinks.ts           the key tasks and notes of an event are stored under
  views/MiniCalendarView.ts  mini calendar
  views/TasksView.ts, views/tasks/   Tasks page
  views/AgendaBlock.ts    the omni-calendar code block
  views/shared.ts         event chips, context menu
  modals/                 dialogs: event, task, list, day tasks, sign-in, details, confirmations
```

### Releasing a new version (needed for BRAT)

BRAT installs from **GitHub releases**. Each release must have `main.js`, `manifest.json` and `styles.css` attached, and the
release tag must exactly match `version` in `manifest.json` (for example `1.0.1`, **without** a `v`).

1. Bump the version: `npm version patch` (this updates `package.json`, `manifest.json` and `versions.json`). You can also edit them by hand.
2. Push the commit and tag: `git push && git push --tags`
3. The **Release Obsidian plugin** GitHub Action builds the plugin and publishes the release.
   You can also start it manually from the *Actions* tab.

## Roadmap ideas

### Tasks (in three releases – steps 1 and 2 are done in 1.7 and 1.8)

A to-do system that lives **inside Omni Calendar**: tasks are created in the plugin, not read from notes. Reading checkboxes from notes was rejected, because formats vary and too many lines would be picked up as tasks by mistake.

**Basics agreed for all steps**
- **Events stay events.** An event, such as a meeting, can **have tasks** ("prepare slides", "send summary"). Tasks can also exist **on their own**.
- **A task has:**
  - title, notes;
  - **list**, **priority** (none / low / medium / high);
  - **date** (optional) and **time or time range** (optional, but usually set, e.g. 10:30–11:00);
  - **subtasks** (one level, like Microsoft To Do's steps);
  - done/open, and *Create note*.
- **Task lists** like Microsoft To Do: your own lists (e.g. *Work*, *Home*, *Project X*) with a colour, plus a default list "Tasks".
- **Automatic lists:**
  - Today, Tomorrow;
  - Upcoming (next 7 days), Overdue;
  - No date, All, Done.

  Each is sorted by priority, then by time.
- **Event tasks appear in the task lists too**, with a small note saying which event they belong to.
- **Linked notes:** you can link **several existing notes** to a task, and later to any event, for example notes you prepared for a piece of work.
  - They're listed neatly under the task or event, and one click opens them.
  - "Link note" opens a quick search over your vault.
  - The notes themselves stay exactly as they are; nothing is read out of them or changed.
  - If you rename or move a linked note, the link follows. If you delete it, the link disappears.
- **As little clutter as possible:** done tasks are struck through, and a setting can hide them. A general **Tasks on/off switch** hides everything task-related without deleting anything.
- The name **"Tasks"** is used everywhere (page, menu, settings, tab title).
- Tasks are stored in the plugin's `data.json`, together with local events. A separate file was the first idea, but it's not certain that Obsidian Sync copies extra files in a plugin folder, and `data.json` demonstrably syncs.

**Step 1 – version 1.7: the basics ✅**
- A dedicated **Tasks page** (full page):
  - automatic lists and your own lists on the left (on the phone, a dropdown or swipe bar at the top);
  - the tasks of the selected list on the right;
  - a **quick-add** box.
- **Tasks in the sidebar**, as a compact version with its **own toggle**, independent of the mini calendar / day planner.
- Creating and editing a task: title, notes, list, priority, date, time / time range, subtasks. Tick off with a checkbox.
- **Linked notes on tasks:** link several notes via a quick search, see them listed under the task, open them with one click, and remove links again.
- Managing lists: create, rename, colour, delete.
- New **Tasks** settings tab: on/off, show completed tasks, default priority, default list. Ribbon menu entry **Open tasks** and commands.

**Step 2 – version 1.8: tasks in the calendar and on events ✅**
- **Tasks with a time range** show as light time blocks in Week/Day, looking clearly different from events.
- **Tasks with only a date** don't get their own entry. Each day shows one small **counter** ("☑ 3"); tapping it lists the tasks. Month view shows just a small badge.
- Tick tasks off and drag them to another day directly in the calendar.
- **Tasks on events:**
  - a "Tasks" section in the event dialog;
  - a progress hint ("2/5") on the event;
  - this also works for Google/Outlook events, but those tasks are stored only in Obsidian.
- The mini calendar gets a small **"Tasks today"** section.
- **Linked notes on events:** the same as on tasks, for local and Google/Outlook events. For Google/Outlook events the links are stored only in Obsidian. The existing single "Create note" becomes one of the linked notes, and older events with a note keep it.

**Version 1.9: details view for events and tasks – in steps (step a ✅ in 1.9.0: the view, Edit notes, quick actions, the setting; step b ✅ in 1.9.2: progress log; step c ✅ in 1.9.3: notes and descriptions for tasks and subtasks)**
- **Clicking** an event or task opens a **large read-only view** by default, instead of the edit dialog. Nothing can be changed by accident.
  - **Event:** title, date/time, calendar, location, description, linked notes, and its tasks (with "2/5").
  - **Task:** title, date/time range, list, priority, notes, subtasks, linked notes, and its event.
- An **Edit** button in the view opens the editing dialog.
- **Editing only the notes in the view (maintainer's wish):** a small **"Edit notes"** button or link next to the description of an event (and the notes of a task).
  - It turns that text into an editable field right in the view, with *Save* / *Cancel*. The rest stays read-only.
  - Not by simply clicking the text, so nothing is changed by accident.
  - For Google/Outlook events the description is saved there.
- Google, Outlook and ICS events already have a read-only view; everything gets the same look.
- **Also agreed:**
  - quick actions stay possible in the view (tick off the task or a subtask, open a linked note);
  - a setting *"Clicking opens: Details view (default) / Edit dialog directly"*;
  - right-click / long-press still offers *Edit* directly.

**Progress log for tasks (maintainer's idea) – ✅ done in 1.9.2**, with a setting to hide it (*Tasks → Progress log*)
- Each task gets a **log** section: type what you've already done or what happened, then **send** it.
- Each entry stays in the task like a **sticky note** with **date and time**. New entries go **below** the older ones, so the history reads top to bottom.
- It's different from subtasks: those are things *to do*, the log records what was *done*.
- **Also agreed:**
  - adding entries also works in the details view without "Edit";
  - a small "📝 3" hint in the task list;
  - entries can be corrected or deleted (the original time stays);
  - maybe the same log for events later; tasks first.
- **Undecided idea: a progress log on events** (not sure yet whether it fits). Today a *tracked* event (*Track as task*)
  has no log, because clicking it opens the event. Two ways, if it's wanted:
  - **small:** only tracked events, the log in the event's details view (stored on the hidden tracking task).
    *Stop tracking* would then have to ask before deleting the entries;
  - **bigger:** a log on every event, stored per event like linked notes. Better to pick one way and not build both.
  - Repeating events only after 1.10.

**"Create note" for tasks (maintainer's idea) – ✅ done in 1.9.3** (in the task dialog, the "add description" link became a small ≡ button per subtask that opens its description and notes)
- Like for events: **right-click a task → Create note**, plus a button in the task dialog and the details view.
- It creates a note named after the date and the task (e.g. *2026-11-24 Prepare workshop*, or just the title without a date) in the notes folder.
- The note is automatically added to the task's **linked notes** and opened. If it already exists, it just opens ("Open note").
- A separate **task note template** in *Settings → Notes*, next to the event template (title, date, time, list, priority, subtasks, …).
- **Also for subtasks:**
  - "Create note" on a subtask (e.g. *2026-11-24 Prepare workshop – Book room*);
  - linked notes on a single subtask, shown as small chips next to it;
  - in the details view, each subtask shows its notes.
- **Short descriptions for subtasks** (agreed, must stay uncluttered):
  - an optional line or two per subtask (e.g. *"Room 4, key at reception"*); longer content belongs in a note;
  - **Task list:** only a small ≡ icon on subtasks that have a description, never the text;
  - **Details view:** the description in small grey text under the subtask;
  - **Task dialog:** a small "add description" link per subtask opens a field only when needed (no big text boxes by default).

**"Track as task" for events – done in 1.8.4 for single events (repeats with step 3)**
- Sometimes an event itself is something to tick off. A checkbox **Track as task** in the event dialog (and in the
  right-click menu) turns it on for that one event. **Off by default**, so the task lists don't fill up with every event.
- The event then appears in the task lists like a task (with its time and a small calendar icon) and can be ticked off there.
- In the calendar it is **not shown twice**: the event gets a small tick circle and is struck through once done.
- It follows the event (title, day) and is deleted with it, like event tasks. Works for Google/Outlook/ICS events too;
  the "done" mark is kept only in Obsidian.
- Repeating events (tick off each repeat separately) come with step 3 (1.10).

**Step 3 – version 1.10: repeating** (renumbered: 1.9 became the details view)
- **Repeating tasks**, each occurrence ticked off separately. A repeating task stays **one** task: each completed occurrence is only a small "done on …" entry, not a copy, so Done doesn't fill up with duplicates.
- **Tasks on repeating events:** the event's task list works as a template, and each occurrence has its own ticks. Ticking one off on 14 Nov doesn't tick it off on 21 Nov.

**Later, maybe:**
- **Microsoft To Do** sync: lists map 1:1. It needs an extra permission (`Tasks.ReadWrite`) and signing in once more.
- Google Tasks.
- Reminders for tasks, together with the notifications feature below.

### Planned after Tasks: event reminders and notifications

- **Reminder field** in the event dialog (none, at start, 5/10/15/30 minutes, 1 hour, 1 day before) and a **default reminder** in settings, plus an on/off switch for each device so two computers don't both notify.
- **Desktop:** system notifications from Obsidian, clicking one opens the event. They work while Obsidian is running (even minimised). Reminders missed while it was closed are shown on the next start.
- **Mobile:** Obsidian plugins can't send phone notifications or run in the background, so there's an in-app pop-up while Obsidian is open, with *Open event* and *Snooze 5 min*.
- **Google / Outlook events:** the reminder is saved in Google or Outlook itself (both APIs support it), so the phone's calendar app sends a **real phone notification**, even when Obsidian is closed. A desktop notification from Obsidian is optional.
- Optional desktop reminders for read-only ICS calendars (e.g. Proton).
- Each reminder fires only once, and timing stays reliable across sleep mode and restarts.

### Other ideas

- **Tasks below the mini calendar:** show the Tasks list under the mini calendar in the same sidebar (split top/bottom), so both are visible without switching tabs. Possible in Obsidian, but harder to make reliable, especially on phones.

- CalDAV write support (iCloud, Fastmail, Nextcloud, …)
- Editing the repeat rule of Google / Outlook series
- Daily-notes integration (open or create the daily note from a day)

## License

MIT
