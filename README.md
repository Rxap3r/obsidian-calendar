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
- [Google & Outlook (two-way)](#two-way-sync-with-google-calendar-and-outlook--microsoft-365): sign-in, editing, security
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
- **Week / Day view:** **click** an empty slot to create an event there. **Click and drag** to create an event covering the selected range (it snaps to 15 minutes). While you drag, a filled preview in the colour of your default calendar shows the exact start and end time. Overlapping events are shown side by side, and a red line marks the current time. Double-click the *all-day* row to create an all-day event.
- **On touch screens:** swipe scrolls as usual, **tap** an empty slot to create an event there, and **press and hold** (about half a second), then drag, to select a time range.
- **Drag and drop:** drag a local, non-recurring event to another day (month view) or another time (week/day view) to move it.
- **Click an event** to edit it. For an external event this shows its details instead. **Right-click an event** for a menu with *Edit*, *Create/Open note*, *Duplicate*, *Delete this occurrence* and *Delete*.

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
- Buttons: **Create/Open note**, **Delete this occurrence** (recurring events only), **Delete / Delete all**, **Save**

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

## Tasks

Tasks are a separate to-do system inside Omni Calendar (new in **1.7**). You create them in the plugin. Nothing is read out of your notes, but you can **link notes** to a task.

**Opening it:**
- ribbon menu → **Open tasks**, or the command **Open tasks**;
- **In the sidebar:** ribbon menu → **Show tasks in sidebar**, or *Settings → Omni Calendar → **Tasks** → Tasks in sidebar*.
  - This is independent of the mini calendar / day planner, so you can have both.
  - It uses the same side as "Calendar in sidebar".
  - The **⤢ button** at the top of the sidebar version opens the full Tasks page with the same list. The sidebar version stays where it is.

**The Tasks page:**
- **Lists on the left.** On the phone and in the sidebar, they become a bar at the top that you swipe sideways.
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
- **Click a task** to edit it. **Right-click** it for quick actions:
  - done / not done;
  - Today / Tomorrow / Next week / No date;
  - priority;
  - delete.
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

**Turning tasks off:** *Settings → Omni Calendar → Tasks → Use tasks*. When it's off, the Tasks page, its menu entries and commands disappear. Your tasks are kept.

Tasks are stored with your local events in the plugin's `data.json`, so they sync the same way (see [Where data is stored](#where-data-is-stored)).

Coming next (see the [roadmap](#roadmap-ideas)):
- **1.8:** tasks in the calendar, tasks on events, and linked notes for events;
- **1.9:** repeating tasks.

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

**Work/school accounts:** many organisations only let users approve verified apps. If you see *"Need admin approval"*, ask your IT team to approve
"Omni Calendar", or use your own app registration (Method B below).

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

### Optional: use your own app registration

Omni Calendar has **no central server**. If you prefer, or your organisation requires it, you can register a small app of your own, so that only you,
your devices and Google/Microsoft are involved. You only do this once per account, and other devices then just sign in with the same Client ID.
The steps are also shown in the sign-in dialog. Click a method below to expand it.

<details>
<summary><b>Method A (optional): own Google app</b></summary>


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
6. In Obsidian: *Settings → Omni Calendar → **Google & Outlook** → **Connect Google*** → *Use my own app registration (advanced)*. Paste both values and click **Sign in with Google**.
7. In the browser, choose your account. Google shows **"Google hasn't verified this app"**. This is expected because the app is your own. Click *Advanced → Go to (your app name)*, then **Allow**.
8. Back in Obsidian, switch on the calendars you want to see.

**Common problems**
- *"Access blocked: app has not completed verification"* → in step 3 you didn't publish the app or add yourself as a test user.
- Signed out again after a week → the app is still in "Testing". Click *Publish app* (step 3).
- *"Error 403: org_internal"* or blocked by your admin → your Workspace administrator doesn't allow it. Use an ICS link instead.

</details>

<details>
<summary><b>Method B (optional): own Microsoft app for a work or school account</b></summary>


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

</details>

<details>
<summary><b>Method C (optional): own Microsoft app for a personal account</b></summary>


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

</details>

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
| | 24-hour clock | `14:00` vs `2pm` |
| | Show week numbers | ISO week numbers in the month view, sidebar and narrow layouts |
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
| | Upcoming list | How far ahead the "Upcoming" list looks: standard periods (default 7 days) or custom |
| | Show completed tasks from the last | Done shows tasks completed in this period (default 30 days, or *Everything*); older ones behind "Show older" |
| | Delete completed tasks after | Automatic clean-up: **Never** (default), the standard periods, or custom. Deleting can't be undone |
| | Default priority / Default list | Used for new tasks |
| | Lists | Rename, recolour, add or delete task lists ("Tasks" is the default list and can't be deleted) |
| **Notes** | Notes folder / Note template | Where *Create note* puts notes, and what goes in them |

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
- **Event notes:** ordinary Markdown files in your notes folder

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

### Tasks (in three releases – step 1 is done in 1.7)

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

**Step 2 – version 1.8: tasks in the calendar and on events**
- **Tasks with a time range** show as light time blocks in Week/Day, looking clearly different from events.
- **Tasks with only a date** don't get their own entry. Each day shows one small **counter** ("☑ 3"); tapping it lists the tasks. Month view shows just a small badge.
- Tick tasks off and drag them to another day directly in the calendar.
- **Tasks on events:**
  - a "Tasks" section in the event dialog;
  - a progress hint ("2/5") on the event;
  - this also works for Google/Outlook events, but those tasks are stored only in Obsidian.
- The mini calendar gets a small **"Tasks today"** section.
- **Linked notes on events:** the same as on tasks, for local and Google/Outlook events. For Google/Outlook events the links are stored only in Obsidian. The existing single "Create note" becomes one of the linked notes, and older events with a note keep it.

**Planned with 1.8 (or right after it): details view for events and tasks**
- **Clicking** an event or task opens a **large read-only view** by default, instead of the edit dialog. Nothing can be changed by accident.
  - **Event:** title, date/time, calendar, location, description, linked notes, and its tasks (with "2/5").
  - **Task:** title, date/time range, list, priority, notes, subtasks, linked notes, and its event.
- An **Edit** button in the view opens the editing dialog.
- Google, Outlook and ICS events already have a read-only view; everything gets the same look.
- **Suggested, not yet confirmed by the maintainer:**
  - quick actions stay possible in the view (tick off the task or a subtask, open a linked note);
  - a setting *"Clicking opens: Details view (default) / Edit dialog directly"*;
  - right-click / long-press still offers *Edit* directly.

**Step 3 – version 1.9: repeating**
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
- Resize events by dragging their edge
- Daily-notes integration (open or create the daily note from a day)

## License

MIT
