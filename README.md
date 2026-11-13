# Calendar Hub for Obsidian

A calendar for Obsidian that you can open as a full page or keep in the sidebar. You can create events
directly in Obsidian, and you can show events from **Google Calendar, Outlook / Microsoft 365, Proton
Calendar, iCloud** or any other calendar that offers an ICS link.

- 📅 **Full-page calendar** with **Month**, **Week**, **Day** and **Agenda** views
- 🗂 **Sidebar mini calendar** with event dots, the selected day's events and an "Upcoming" list
- ✍️ **Create, edit, duplicate and delete events** inside Obsidian, including all-day, multi-day and recurring events (daily / weekly / monthly / yearly)
- 🖱 **Drag to create** a time range in week/day view. **Drag and drop** events to move them
- 🌐 **External calendars (read-only)**: subscribe to ICS / iCal links from Google, Outlook, Proton, iCloud, Fastmail, Nextcloud and others. Recurring events, exceptions and time zones are supported
- 📝 **Notes for events**: create a note from any event using a template you can change. Local events stay linked to their note
- 🎨 Several local calendars, each with its own colour, and a filter to show or hide calendars
- 📋 **Embed an agenda in any note** with a `calendar-hub` code block
- 📤 **Export** your local events to an `.ics` file, which you can import into Google, Outlook or Proton
- 📱 Works on desktop and mobile. It follows your light/dark theme

---

## Installation with BRAT (beta)

1. Install **BRAT** ("Obsidian42 - BRAT") from *Settings → Community plugins → Browse*, then enable it.
2. Open *Settings → BRAT → "Add Beta plugin"* (or run the command **BRAT: Add a beta plugin for testing**).
3. Enter the repository: `rxap3r/obsidian-calendar`
4. Click **Add Plugin**. BRAT downloads the latest release.
5. Enable **Calendar Hub** under *Settings → Community plugins*.

BRAT checks for updates automatically. You can also run **BRAT: Check for updates to all beta plugins**.

### Manual installation

Download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/rxap3r/obsidian-calendar/releases) and put them in
`<your vault>/.obsidian/plugins/calendar-hub/`. Then reload Obsidian and enable the plugin.

---

## Using the calendar

### Opening it

| How | What it opens |
| --- | --- |
| Ribbon icon 📅 (left bar) | Full-page calendar in a new tab |
| Command **Calendar Hub: Open calendar (full page)** | Full-page calendar |
| Command **Calendar Hub: Show calendar in sidebar** | Mini calendar in the right sidebar. You can drag it to the left sidebar if you prefer |
| Commands **Open month / week / day / agenda view** | The full calendar in that view |

On first install the mini calendar is added to the right sidebar automatically.

### Full-page calendar

- **Toolbar:** `‹ Today ›` navigates. *Month / Week / Day / Agenda* switches the view. The filter icon shows or hides individual calendars. ⟳ re-downloads external calendars. **+ New** creates an event.
- **Month view:** click a **day number** to open that day. **Double-click** a cell, or click the **+** that appears on hover, to create an event. When a day is full, click "+N more".
- **Week / Day view:** **click** an empty slot to create an event there. **Click and drag** to create an event covering the selected range (it snaps to 15 minutes). Overlapping events are shown side by side, and a red line marks the current time. Double-click the *all-day* row to create an all-day event.
- **Drag and drop:** drag a local, non-recurring event to another day (month view) or another time (week/day view) to move it.
- **Click an event** to edit it. For an external event this shows its details instead. **Right-click an event** for a menu with *Edit*, *Create/Open note*, *Duplicate*, *Delete this occurrence* and *Delete*.

### Sidebar mini calendar

- Coloured dots show which days have events.
- Click a day to list its events below the calendar. Double-click a day to open it in the full calendar.
- The **Upcoming** section lists the next *N* days. You can set *N* in settings.
- The buttons at the top are: previous/next month, today, new event, and open the full calendar.

### Creating and editing events

The event dialog has these fields:

- **Title** (press `Enter` to save) and **Calendar** (which local calendar the event belongs to)
- **All day** on or off, plus **Starts** and **Ends**. If you move the start, the end moves with it so the duration stays the same.
- **Repeat:** daily, weekly, monthly or yearly, every *N* units. It can end *never*, *on a date* or *after N times*.
- **Location** and **Description**
- Buttons: **Create/Open note**, **Delete this occurrence** (recurring events only), **Delete / Delete all**, **Save**

Editing a recurring event changes **every occurrence** of it. To remove a single date, use *Delete this occurrence*.

### Notes for events

*Create note* makes a note named `YYYY-MM-DD Event title.md` in the notes folder (default `Calendar/`) and opens it.
The note is built from a template you can change in settings. The template can use these placeholders:

`{{title}} {{date}} {{start}} {{end}} {{when}} {{location}} {{calendar}} {{description}}`

A local, non-recurring event remembers its note. After that the button reads *Open note*, and the link still works if you rename the note.
The command **Create event linked to current note** creates an event from the active note and links the two. If the note's
filename contains a date (e.g. `2026-11-20 Kickoff`), that date is used.

### Agenda inside a note

````markdown
```calendar-hub
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

## Connecting external calendars (Google, Outlook, Proton, …)

Go to *Settings → Calendar Hub → External calendars → **Add external calendar***. Give it a name and colour, and paste the calendar's
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
> `.obsidian/plugins/calendar-hub/data.json`. If your vault is synced or shared publicly, keep that in mind.

### Why are external calendars read-only?

ICS links can only be read. To write events back to Google or Outlook, the plugin would need an OAuth sign-in
through Google Cloud or Azure app registrations. Proton Calendar has no public API at all.
To keep the plugin simple and private, with no accounts, servers or tokens, events you create live in Obsidian's **local
calendars**. You can still:

- use **Copy to local calendar** on an external event to make an editable copy, and
- run **Export local events to .ics file** and import that file into Google, Outlook or Proton.

Two-way sync could be added later. See the roadmap below.

---

## Settings reference

| Setting | Description |
| --- | --- |
| First day of the week | Sunday through Saturday |
| 24-hour clock | `14:00` vs `2pm` |
| Default view | The view used when the calendar page opens |
| Show week numbers | ISO week numbers in the month view and sidebar |
| Scroll to hour | Where week/day views start scrolled. If today is visible, the view scrolls to the current time |
| Default event duration | Length of a new event, in minutes |
| Agenda length | Number of days in the Agenda view |
| Sidebar: upcoming days | Days listed under "Upcoming". `0` hides the list |
| Notes folder / Note template | Where *Create note* puts notes, and what goes in them |
| Local calendars | Add, rename, recolour, hide or delete calendars, and pick ★ the default one |
| External calendars | Name, colour, ICS URL, on/off, refresh and remove. Each shows its status (event count, last update or error) |
| Refresh interval | How often external calendars are re-downloaded, in minutes. `0` means manual only |

## Commands

- Open calendar (full page)
- Show calendar in sidebar
- Open month / week / day / agenda view
- Create new event
- Create event linked to current note
- Refresh external calendars
- Export local events to .ics file

## Where data is stored

- **Local events and settings:** `.obsidian/plugins/calendar-hub/data.json`. Obsidian Sync and other sync tools carry them to your other devices. The plugin reloads automatically when Sync changes this file.
- **Cached external calendars:** `.obsidian/plugins/calendar-hub/cache/*.ics`
- **Event notes:** ordinary Markdown files in your notes folder

The plugin only makes network requests to the ICS URLs you configure.

---

## Development

```bash
npm install
npm run dev     # watch mode – builds main.js on change
npm run build   # type-check + production build
```

To try it in a vault, symlink or copy the repository folder (or just `main.js`, `manifest.json`, `styles.css`) into
`<vault>/.obsidian/plugins/calendar-hub/`.

Project layout:

```
src/
  main.ts                 plugin entry: views, commands, code block, export
  store.ts                local events, recurrence expansion, ICS fetching and caching
  ics.ts                  ICS parsing (ical.js), time zones, recurrence, .ics export
  settings.ts             settings tab
  notes.ts                event → note creation and template
  dateUtils.ts            date helpers
  views/CalendarView.ts   full-page month/week/day/agenda view
  views/MiniCalendarView.ts sidebar calendar
  views/shared.ts         event chips, context menu
  modals/EventModal.ts    create/edit dialog
  modals/EventDetailsModal.ts details for external events
```

### Releasing a new version (needed for BRAT)

BRAT installs from **GitHub releases**. Each release must have `main.js`, `manifest.json` and `styles.css` attached, and the
release tag must exactly match `version` in `manifest.json` (for example `1.0.1`, **without** a `v`).

1. Bump the version: `npm version patch` (this updates `package.json`, `manifest.json` and `versions.json`). You can also edit them by hand.
2. Push the commit and tag: `git push && git push --tags`
3. The **Release Obsidian plugin** GitHub Action builds the plugin and publishes the release.
   You can also start it manually from the *Actions* tab.

## Roadmap ideas

- Two-way sync with Google Calendar / Microsoft Graph (OAuth) and CalDAV servers
- Resize events by dragging their edge
- Daily-notes integration (open or create the daily note from a day)
- Event reminders and notifications

## License

MIT
