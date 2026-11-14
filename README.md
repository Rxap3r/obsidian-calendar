# Omni Calendar for Obsidian

A calendar for Obsidian that you can open as a full page or keep in the sidebar. You can create events
directly in Obsidian, and you can show events from **Google Calendar, Outlook / Microsoft 365, Proton
Calendar, iCloud** or any other calendar that offers an ICS link.

- 📅 **Full-page calendar** with **Month**, **Week**, **Day** and **Agenda** views
- 🗂 **Sidebar mini calendar** with event dots, the selected day's events and an "Upcoming" list
- ✍️ **Create, edit, duplicate and delete events** inside Obsidian, including all-day, multi-day and recurring events (daily / weekly / monthly / yearly)
- 🖱 **Drag to create** a time range in week/day view. **Drag and drop** events to move them
- 🔄 **Two-way Google Calendar & Outlook / Microsoft 365**: connect your account to show its calendars and create, edit, move and delete events from Obsidian. Both are a one-click sign-in with no setup, using secure OAuth sign-in, and tokens stay in Obsidian's secure storage on each device
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
| Ribbon icon 📅 (left bar), **click** | Full-page calendar in the main area |
| Ribbon icon 📅, **right-click** | Menu: open full calendar, show/hide the mini or full calendar in the sidebar, new event |
| Command **Omni Calendar: Open calendar (full page)** | Full-page calendar in the main area |
| Command **Toggle mini calendar in sidebar** | Shows the mini calendar in the sidebar, or hides it if it's already there |
| Command **Toggle full calendar in sidebar** | The same for the full calendar (month/week/day/agenda), in a compact layout |
| Commands **Open month / week / day / agenda view** | The full calendar in that view |
| Button ⤢ / ⇥ in the calendar's toolbar | In the sidebar: **open the full page** (the sidebar calendar stays). In the main area: **move this calendar to the sidebar** |

You never have to drag anything. *Open calendar* always opens in the main area, even if a calendar already sits in a sidebar.

**Calendar in the sidebar:** in *Settings → General → **Calendar in sidebar***, choose **Off / Mini calendar / Full calendar** and the **side**
(left or right). Changes apply **immediately** and are restored every time Obsidian starts. The toggle commands and the ribbon
right-click menu change the same setting. If you close the sidebar calendar yourself (or drag it somewhere else), the setting
follows, so it never pops back unexpectedly. Commands can be given hotkeys in *Settings → Hotkeys* (search for "Omni Calendar").

### Full-page calendar

- **Toolbar:** `‹ Today ›` navigates. *Month / Week / Day / Agenda* switches the view. The filter icon shows or hides individual calendars. ⟳ re-downloads external calendars. **+ New** creates an event.
- **Month view:** click a **day number** to open that day. **Double-click** a cell, or click the **+** that appears on hover, to create an event. When a day is full, click "+N more".
- **Week / Day view:** **click** an empty slot to create an event there. **Click and drag** to create an event covering the selected range (it snaps to 15 minutes).
  **On touch screens:** swipe scrolls as usual, **tap** an empty slot to create an event there, and **press and hold** (about half a second), then drag, to select a time range. Overlapping events are shown side by side, and a red line marks the current time. Double-click the *all-day* row to create an all-day event.
- **Drag and drop:** drag a local, non-recurring event to another day (month view) or another time (week/day view) to move it.
- **Click an event** to edit it. For an external event this shows its details instead. **Right-click an event** for a menu with *Edit*, *Create/Open note*, *Duplicate*, *Delete this occurrence* and *Delete*.

**Adapts to its width** (handy in a sidebar):
- In a narrow view, *Month* switches from the 7-column grid to **day cards** in one or more columns, and *Week* shows **fewer days side by side** (e.g. 3 days). The arrows then move by that many days.
- In a very wide sidebar the calendar stops growing at a comfortable width and stays centred, instead of stretching the days apart.

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

### Choosing which calendars new events go to

- **Default:** *Settings → Omni Calendar → **New events*** lists every calendar you can write to: your local calendars, plus the Google and Outlook
  calendars that are switched on and signed in on this device. Switch on one, several or all of them. New events are saved there by default.
- **For each event:** the *Save to* row in the event dialog shows one button per calendar, with your defaults already selected. Click a button
  to add or remove that calendar for this event only.
- **Several calendars:** the event is created in each selected calendar as a **separate copy**. Editing or deleting one copy later doesn't change the
  others. If saving fails for one calendar (e.g. you're offline), the others are still saved and you're told which one failed.

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

Connect an account in *Settings → Omni Calendar → **Google & Outlook accounts***. The account's calendars then appear in
Omni Calendar. In calendars you can write to, you can **create, edit, move (drag & drop) and delete** events, and every change
is saved straight to Google or Outlook. Calendars shared with you read-only (e.g. holidays) are shown but can't be edited.

### Microsoft (Outlook.com, Hotmail, Live, Microsoft 365): just sign in

1. *Settings → Omni Calendar → **Connect Outlook / Microsoft 365***. Leave *How do you want to connect?* on **Quick sign-in (recommended)**.
2. Click **Sign in with Microsoft**, sign in with your account in the browser and click **Accept**.
3. Back in Obsidian, switch on the calendars you want to see.

This uses Omni Calendar's built-in Microsoft app registration, so you don't need an Azure account or any setup. Its client ID is public by design (every
desktop app's ID is). It gives the plugin no access by itself: access only exists through the sign-in that happens on *your* device, with
PKCE, and the tokens stay on that device. No Omni Calendar server is involved.

**What you'll see:** Microsoft asks you to allow *Omni Calendar* to **read and write your calendars** and to **keep access** (so you stay signed in).
It asks for nothing else: no e-mail, contacts or files. The app may be marked **"unverified"**. That only means the publisher hasn't done Microsoft's
partner verification, and the sign-in itself is Microsoft's standard sign-in.

**Work/school accounts:** many organisations only let users approve verified apps. If you see *"Need admin approval"*, ask your IT team to approve
"Omni Calendar", or use your own app registration (Method B below).

### Google: just sign in

1. *Settings → Omni Calendar → **Connect Google account***. Leave *How do you want to connect?* on **Quick sign-in (recommended)**.
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

### Optional: use your own app registration

Omni Calendar has **no central server**. If you prefer, or your organisation requires it, you can register a small app of your own, so that only you,
your devices and Google/Microsoft are involved. The steps below are also shown in the sign-in dialog. You only do this once per account.
Other devices then just sign in with the same Client ID.

#### Method A (optional): own Google app

**You need**
- A Google account (personal Gmail works. With a Google Workspace work/school account, your admin may block self-made apps)
- About 10–15 minutes on a desktop computer
- No credit card and no billing account. The Google Calendar API is free for this kind of personal use

**Steps**

1. Open [console.cloud.google.com](https://console.cloud.google.com) and sign in. Create a **new project** (top bar → project picker → *New project*, any name such as "Obsidian Calendar").
2. *APIs & Services → Library* → search **Google Calendar API** → **Enable**.
3. *Google Auth Platform* (formerly *OAuth consent screen*) → *Get started*:
   - App name: anything (e.g. "My Obsidian Calendar"). Support and contact e-mail: your address.
   - Audience: **External**.
   - Under **Audience**, click **Publish app** (status "In production"). Otherwise Google signs you out every 7 days. You don't need to submit for verification.
4. *Clients* (or *Credentials*) → **Create client** → application type **Desktop app** → *Create*.
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) and the **Client secret** (starts with `GOCSPX-`).
6. In Obsidian: *Settings → Omni Calendar → **Connect Google account*** → *Use my own app registration (advanced)*. Paste both values and click **Sign in with Google**.
7. In the browser, choose your account. Google shows **"Google hasn't verified this app"**. This is expected because the app is your own. Click *Advanced → Go to (your app name)*, then **Allow**.
8. Back in Obsidian, switch on the calendars you want to see.

**Common problems**
- *"Access blocked: app has not completed verification"* → in step 3 you didn't publish the app or add yourself as a test user.
- Signed out again after a week → the app is still in "Testing". Click *Publish app* (step 3).
- *"Error 403: org_internal"* or blocked by your admin → your Workspace administrator doesn't allow it. Use an ICS link instead.

#### Method B (optional): own Microsoft app for a work or school account

**You need**
- A work or school Microsoft 365 account
- Permission to register apps in your organisation. Most organisations allow it by default. If *New registration* is greyed out or forbidden, ask your IT team to create the registration for you (steps below) or to allow it
- About 10 minutes. No client secret and no cost

**Steps**

1. Open [entra.microsoft.com](https://entra.microsoft.com) (or [portal.azure.com](https://portal.azure.com)) with your work account → *App registrations* → **New registration**.
2. Name: anything. **Supported account types:** *Accounts in this organizational directory only* (single tenant) or *Accounts in any organizational directory*.
3. **Redirect URI:** platform **Public client/native (mobile & desktop)**, value `http://localhost` → **Register**.
4. *API permissions* → *Add a permission* → *Microsoft Graph* → *Delegated permissions* → tick **Calendars.ReadWrite** → *Add permissions*. (`offline_access` is requested automatically at sign-in.)
5. On the *Overview* page, copy the **Application (client) ID**. For a single-tenant app, also copy the **Directory (tenant) ID**.
6. In Obsidian: **Connect Outlook / Microsoft 365** → *Use my own app registration (advanced)* → paste the client ID → account type **Work or school only**, or **Other (tenant ID)** for a single-tenant app → **Sign in with Microsoft**.

**Common problems**
- *"Need admin approval"* → your organisation requires an administrator to consent. Send the app's client ID to IT and ask them to *Grant admin consent* for Calendars.ReadWrite.
- *AADSTS50194 / "not configured as a multi-tenant application"* → choose **Other (tenant ID)** and enter your Directory (tenant) ID.

#### Method C (optional): own Microsoft app for a personal account

You only need this if you don't want to use the built-in app. Microsoft only lets you create app registrations inside a Microsoft Entra **directory (tenant)**,
though, and a personal account doesn't have one on its own. You get a directory by signing up for a free Azure account.

**You need**
- Your Outlook.com / Hotmail / Live account
- A **free Azure account** ([azure.microsoft.com/free](https://azure.microsoft.com/free)). Microsoft asks for a phone number and a credit card to verify your identity. Creating the app registration costs nothing, and you don't need any paid Azure services. Reports say the registration keeps working after the free trial ends because it belongs to the directory, not the subscription, but Microsoft doesn't explicitly guarantee this.
- About 20–30 minutes

**Steps**

1. Sign up at [azure.microsoft.com/free](https://azure.microsoft.com/free) with your Outlook.com account (skip this if you already have Azure). This creates your directory.
2. Open [portal.azure.com](https://portal.azure.com) → search **App registrations** → **New registration**.
3. Name: anything. **Supported account types:** **Personal Microsoft accounts only**, or *Accounts in any organizational directory and personal Microsoft accounts*.
4. **Redirect URI:** platform **Public client/native (mobile & desktop)**, value `http://localhost` → **Register**.
5. *API permissions* → *Add a permission* → *Microsoft Graph* → *Delegated* → **Calendars.ReadWrite** → *Add permissions*.
6. Copy the **Application (client) ID** from the *Overview* page.
7. In Obsidian: **Connect Outlook / Microsoft 365** → *Use my own app registration (advanced)* → paste the client ID → account type **Personal** → **Sign in with Microsoft** → sign in with your Outlook.com account and **Accept**.

**Common problems**
- *"You can't create app registrations"* or no directory shown → the Azure sign-up (step 1) isn't finished.
- *AADSTS50020 / "account does not exist in tenant"* → the app was registered for organisational accounts only. Change *Supported account types* to include personal accounts (*Authentication* page), or re-register.
- *"unauthorized_client"* → the redirect URI platform isn't **Public client/native**, or the value isn't exactly `http://localhost`.

#### Signing in (all methods)

Your browser opens, you sign in there and approve access, and Obsidian picks up the result automatically. On **mobile**, or if the browser
can't hand the result back, the browser ends on a "can't connect to localhost" page. That's expected. Copy that page's full address
and paste it into the sign-in dialog. Sign-in tokens stay on the device, so each device signs in once with the same Client ID
(and, for Google, the same Client secret).

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
| Calendar in sidebar | Off / mini calendar / full calendar, and left or right side. Applied immediately and kept after restarts |
| Sidebar: upcoming days | Days listed under "Upcoming". `0` hides the list |
| Notes folder / Note template | Where *Create note* puts notes, and what goes in them |
| New events | Which calendars (local, Google, Outlook – one, several or all) new events are saved to by default |
| Local calendars | Add, rename, recolour, hide or delete calendars |
| Google & Outlook accounts | Connect, reconnect, sign out or remove accounts. Show or hide each of an account's calendars and set its colour and display name |
| External calendars | Name, colour, ICS URL, on/off, refresh and remove. Each shows its status (event count, last update or error) |
| Refresh interval | How often external calendars are re-downloaded, in minutes. `0` means manual only |

## Commands

- Open calendar (full page)
- Toggle mini calendar in sidebar / Toggle full calendar in sidebar
- Show mini calendar in sidebar
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

**Built-in Google sign-in:** the Google OAuth client is not stored in the repository. The build reads it from the environment variables
`OMNI_GOOGLE_CLIENT_ID` and `OMNI_GOOGLE_CLIENT_SECRET`. The release workflow takes them from the repository secrets of the same names
(*Settings → Secrets and variables → Actions*). Without them the build still works, and Google is then connected with your own app registration.

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
