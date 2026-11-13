# Omni Calendar for Obsidian

A calendar for Obsidian that you can open as a full page or keep in the sidebar. You can create events
directly in Obsidian, and you can show events from **Google Calendar, Outlook / Microsoft 365, Proton
Calendar, iCloud** or any other calendar that offers an ICS link.

- 📅 **Full-page calendar** with **Month**, **Week**, **Day** and **Agenda** views
- 🗂 **Sidebar mini calendar** with event dots, the selected day's events and an "Upcoming" list
- ✍️ **Create, edit, duplicate and delete events** inside Obsidian, including all-day, multi-day and recurring events (daily / weekly / monthly / yearly)
- 🖱 **Drag to create** a time range in week/day view. **Drag and drop** events to move them
- 🔄 **Two-way Google Calendar & Outlook / Microsoft 365**: connect your account to show its calendars and create, edit, move and delete events from Obsidian. The connection uses secure OAuth sign-in and your own app registration, and tokens stay in Obsidian's secure storage on each device
- 🌐 **External calendars (read-only)**: subscribe to ICS / iCal links from Google, Outlook, Proton, iCloud, Fastmail, Nextcloud and others. Recurring events, exceptions and time zones are supported
- 📝 **Notes for events**: create a note from any event using a template you can change. Local events stay linked to their note
- 🎨 Several local calendars, each with its own colour, and a filter to show or hide calendars
- 📋 **Embed an agenda in any note** with a `omni-calendar` code block
- 📤 **Export** your local events to an `.ics` file, which you can import into Google, Outlook or Proton
- 📱 Works on desktop and mobile. It follows your light/dark theme

---

## Installation with BRAT (beta)

1. Install **BRAT** ("Obsidian42 - BRAT") from *Settings → Community plugins → Browse*, then enable it.
2. Open *Settings → BRAT → "Add Beta plugin"* (or run the command **BRAT: Add a beta plugin for testing**).
3. Enter the repository: `rxap3r/obsidian-calendar`
4. Click **Add Plugin**. BRAT downloads the latest release.
5. Enable **Omni Calendar** under *Settings → Community plugins*.

BRAT checks for updates automatically. You can also run **BRAT: Check for updates to all beta plugins**.

> **Renamed in 1.0.1:** this plugin was first released as "Calendar Hub" (ID `calendar-hub`). That ID already belongs to a
> different plugin in the community store, so Obsidian confused the two. If you installed 1.0.0, uninstall it, delete
> `.obsidian/plugins/calendar-hub/`, and add the plugin through BRAT again. Before deleting, copy `data.json` from the old folder to
> `.obsidian/plugins/omni-calendar/` if you want to keep events you already created.

### Manual installation

Download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/rxap3r/obsidian-calendar/releases) and put them in
`<your vault>/.obsidian/plugins/omni-calendar/`. Then reload Obsidian and enable the plugin.

---

## Using the calendar

### Opening it

| How | What it opens |
| --- | --- |
| Ribbon icon 📅 (left bar) | Full-page calendar in a new tab |
| Command **Omni Calendar: Open calendar (full page)** | Full-page calendar |
| Command **Omni Calendar: Show calendar in sidebar** | Mini calendar in the right sidebar. You can drag it to the left sidebar if you prefer |
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

## Two-way sync with Google Calendar and Outlook / Microsoft 365

Connect an account in *Settings → Omni Calendar → **Google & Outlook accounts***. The account's calendars then appear in
Omni Calendar. In calendars you can write to, you can **create, edit, move (drag & drop) and delete** events, and every change
is saved straight to Google or Outlook. Calendars shared with you read-only (e.g. holidays) are shown but can't be edited.

### One-time setup: your own app registration

Omni Calendar has **no central server and no shared app**. You register a small app of your own with Google or
Microsoft. It's free, takes about 10 minutes, and means only you and Google/Microsoft are involved. The steps are also shown in the
sign-in dialog.

**Google**

1. Open [console.cloud.google.com](https://console.cloud.google.com) and create a project (any name).
2. *APIs & Services → Library* → enable **Google Calendar API**.
3. *OAuth consent screen* (Google Auth Platform): choose **External** and enter an app name and your e-mail address. Under *Audience*, add yourself
   as a test user, then click **Publish app**. Otherwise Google ends the sign-in after 7 days. Because the app is yours and unverified, Google
   shows a "Google hasn't verified this app" warning when you sign in. Click *Advanced → Go to (your app)*. That is expected, and safe
   because you made the app.
4. *Clients / Credentials* → **Create OAuth client** → type **Desktop app**.
5. In Obsidian, click **Connect Google account**, paste the **Client ID** and **Client secret**, then click **Sign in with Google**.

**Microsoft (Outlook.com, Hotmail, Microsoft 365)**

1. Open [portal.azure.com](https://portal.azure.com) or [entra.microsoft.com](https://entra.microsoft.com) → *App registrations* → **New registration**.
2. Supported account types: *Accounts in any organizational directory and personal Microsoft accounts* (or *Personal accounts only*).
3. Redirect URI: platform **Public client/native (mobile & desktop)**, value `http://localhost`.
4. *API permissions* → *Add a permission* → *Microsoft Graph* → *Delegated* → **Calendars.ReadWrite**.
5. In Obsidian, click **Connect Outlook / Microsoft 365**, paste the **Application (client) ID**, choose the matching account type, then click **Sign in with Microsoft**.

Your browser opens, you sign in there and approve access, and Obsidian picks up the result automatically. On mobile, or if the browser
can't hand the result back, the browser shows a "can't connect to localhost" page. Copy that page's address and paste it into the dialog.

After signing in, switch on the calendars you want to see. The primary calendar is on by default.

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
| **No middleman** | You use your own app registration. Requests go only to `accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com`, `login.microsoftonline.com` and `graph.microsoft.com`, always over HTTPS. The plugin refuses to send a token to any other host. |
| **Token storage** | The refresh token, and Google's client secret, are kept only in **Obsidian's secure storage** (SecretStorage, Obsidian 1.11.4+) **on this device**. They are never written to `data.json`, your vault or your sync, and never to logs or error messages. Access tokens are kept only in memory and expire after about an hour. Each device signs in separately. |
| **Least privilege** | Google: `calendar.events` and `calendar.calendarlist.readonly`. Microsoft: `Calendars.ReadWrite` and `offline_access`. No access to e-mail, contacts, files or your profile. |
| **Event data** | Events from connected accounts are kept in memory only, not cached to disk. |
| **Sign out** | *Sign out* deletes the token from this device. For Google it also revokes access at Google. For Microsoft, you can also remove the app at [account.microsoft.com → Privacy → Apps and services](https://account.microsoft.com/privacy/app-access) (personal accounts) or [myapps.microsoft.com](https://myapps.microsoft.com) (work accounts). *Remove account* also deletes the stored client secret. |

> Connecting accounts needs **Obsidian 1.11.4 or newer**. Older versions have no secure storage, and Omni Calendar won't store tokens anywhere else.

---

## Read-only subscriptions via ICS link (Proton, iCloud, Google, Outlook, …)

Go to *Settings → Omni Calendar → External calendars → **Add external calendar***. Give it a name and colour, and paste the calendar's
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
| Google & Outlook accounts | Connect, reconnect, sign out or remove accounts. Show or hide each of an account's calendars and set its colour and display name |
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

- **Local events and settings:** `.obsidian/plugins/omni-calendar/data.json`. Obsidian Sync and other sync tools carry them to your other devices. The plugin reloads automatically when Sync changes this file.
- **Cached ICS calendars:** `.obsidian/plugins/omni-calendar/cache/*.ics`
- **Google / Outlook:** account settings (client ID, account label, chosen calendars) are in `data.json`. Sign-in tokens and the Google client secret are **only** in Obsidian's secure storage on each device. Events are kept in memory.
- **Event notes:** ordinary Markdown files in your notes folder

The plugin only makes network requests to the ICS URLs you configure and, for connected accounts, to Google or Microsoft.

---

## Development

```bash
npm install
npm run dev     # watch mode – builds main.js on change
npm run build   # type-check + production build
```

To try it in a vault, symlink or copy the repository folder (or just `main.js`, `manifest.json`, `styles.css`) into
`<vault>/.obsidian/plugins/omni-calendar/`.

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

- CalDAV write support (iCloud, Fastmail, Nextcloud, …)
- Editing the repeat rule of Google / Outlook series
- Resize events by dragging their edge
- Daily-notes integration (open or create the daily note from a day)
- Event reminders and notifications

## License

MIT
