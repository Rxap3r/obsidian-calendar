# CLAUDE.md – how we work on Omni Calendar

Omni Calendar is an Obsidian plugin (TypeScript, bundled with esbuild). It provides a full-page and sidebar
calendar, local events, two-way Google Calendar and Outlook / Microsoft 365 sync, and read-only ICS subscriptions.
It is installed by users via **BRAT** from GitHub releases. The user-facing documentation is `README.md`.
Read it for the feature set.

The maintainer (repo owner) tests on a **desktop computer and a phone** (Obsidian mobile) and prefers explanations in
plain language: what changed, why, and what to check. Avoid jargon. Be honest about what was and wasn't tested.

**Repository:** `Rxap3r/omni-calendar` on GitHub. It was renamed from `obsidian-calendar`; GitHub redirects the old name,
but use the new one for pull requests and in docs.
The maintainer merges PRs and pushes the release tag themselves.

## Workflow rules (important)

1. **Branch:** always work on **`dev-branch`**. Before starting, update it from `main`:
   `git fetch origin main && git merge --ff-only origin/main` (or a normal merge if needed). Never push to `main` directly.
   **Cloud sessions (Claude Code on the web):** the session creates its own working branch (e.g. `ccr-…` or `claude/…`)
   and says to push only there. The maintainer's standing instruction overrides that: work on `dev-branch` and push
   to it directly; don't push to the session's own branch (it only clutters GitHub).
2. **Fixes are collected, not released one by one (agreed with the maintainer).** When the maintainer reports a bug,
   fix it on `dev-branch` right away (with a test) and add a line under **Not released yet** in `CHANGELOG.md`.
   Write the line in plain language, saying what the user notices. Do **not** open a PR for each fix.
   If a bug can't be fixed right away, list it under **Known bugs** in `CHANGELOG.md`.
   Features from the roadmap are also listed under *Not released yet* once they're on `dev-branch`.
3. **Version number:** `dev-branch` always carries the *next* release number. Set it once, when the first unreleased change
   lands after a release, in `manifest.json`, `package.json` and `versions.json` together: patch for fixes and small
   features, minor for bigger features. Then run `npm install --package-lock-only`, and keep the number in the *Not released
   yet* heading in sync. If the maintainer merged a PR, the next change needs a new number.
4. **Commit and push** to `dev-branch` after each finished change. Commit messages explain *why*.
5. **Pull requests only when the maintainer asks** ("pull it", "open a PR", …). Open the PR from `dev-branch` to `main`.
   The PR description has:
   - *Summary*: the *Not released yet* list;
   - *Testing*: say clearly what was not tested on a real device or in real Obsidian;
   - *After merging*: `git tag X.Y.Z && git push origin X.Y.Z`, or run the release workflow.

   In the same PR, turn *Not released yet* into a `## X.Y.Z` entry under *Released*, and start a new empty
   *Not released yet* section.
6. Keep `README.md` in sync with every feature or settings change (paths like *Settings → Omni Calendar → Display*).
   Ideas go into its **Roadmap** section.

## Build, test, release

```bash
npm install
npm run build        # type-check (tsc) + production bundle → main.js
npm test             # build + tests/sync (Node) + tests/ui (headless Chromium) – see tests/README.md
```

- **Always run `npm test` before committing.** For UI changes, also look at the screenshots in `tests/.out/shots/`
  and add or extend a test in the matching topic file in `tests/ui/specs/`. Open only that file, to save tokens. Test **mobile** (`{ mobile: true }`) when layout, tapping or touch matters; don't add a desktop/mobile pair when the check doesn't depend on the screen (agreed with the maintainer, to keep the test count down). Wait with `settle(page)` instead of fixed pauses, except for drags, touch, scrolling and the sidebar (see `tests/README.md`).
- **Release:** pushing a tag equal to `manifest.json`'s version (no `v` prefix) runs `.github/workflows/release.yml`,
  which attaches `main.js`, `manifest.json` and `styles.css` to a GitHub release. BRAT installs from that.
- `main.js` and `dist/` are git-ignored build output.
- **GitHub check** (`.github/workflows/ci.yml`): every push builds and runs both test suites. Playwright is installed there only for
  the run; it is not in `package.json`. The downloaded browser is kept in GitHub's Actions cache (version `1.63.0`, set in two
  places in `ci.yml`). After pushing, check that the run passed (Actions tab / `actions_list`), not only the local run.
- **Testing before release:** the maintainer tests after merging and releasing; fixes then go out as the next patch.
  A downloadable test build per push was offered and declined. (Note: builds made outside the release workflow have no
  built-in Google sign-in, so Google quick sign-in accounts can't refresh with them.)
- **UI tests run one at a time on purpose.** Running them in parallel was discussed and the maintainer declined it
  (fear of false failures); don't bring it back unless asked. Tests that type into a dialog must wait ~100 ms after
  opening it (the dialog focuses the title first), and drag tests must wait until the grid has stopped scrolling.
- The type check is strict and also fails on unused variables and imports (`tsconfig.json`).

## Architecture (src/)

Files are kept small on purpose: when a file grows past roughly 300–400 lines, split it by topic like the folders below.
Shared helpers live in one place. Before writing a small helper (error text, plural, colour, date maths), check
`util.ts`, `dateUtils.ts`, `periods.ts`, `defaults.ts` and `views/shared.ts`.

| File | Purpose |
| --- | --- |
| `main.ts` | Plugin entry: start-up, ribbon icon + calendar menu, opening pages (`openCalendar`, `openTasks`), `persist`, refresh timer, event notes |
| `commands.ts` | All commands (`registerCommands`). The ids must stay stable |
| `sidebar.ts` | `SidebarManager` (`plugin.sidebar`): mini calendar, day planner and Tasks in the sidebar (`apply`, `applyTasks`, `toggle`, `expand`, `syncSetting`) |
| `settingsData.ts` | `normalizePluginData`: loading and checking `data.json`, defaults, **migrations** |
| `defaults.ts` | `DEFAULT_SETTINGS`, `PALETTE`, `nextColor` |
| `types.ts` | All data types (`OmniCalendarSettings`, `LocalEvent`, `CalendarSource`, `Account`, `CalendarOccurrence`, …) |
| `store.ts` | Data layer: local events + recurrence expansion, ICS fetching/caching, remote (Google/Outlook) events, writes (`createRemote`, `updateRemote`, `deleteRemote`, `moveOccurrence`), change events |
| `ics.ts`, `icsExport.ts` | ICS parsing via ical.js (time zones incl. Windows names, RRULE, exceptions); `.ics` export of local events |
| `sync/oauth.ts` | OAuth 2.0 authorization code + PKCE, loopback redirect server, manual paste fallback, token refresh |
| `sync/accounts.ts` | Connected accounts, tokens in Obsidian SecretStorage, refresh, sign-out/revoke, calendar list → sources |
| `sync/providers.ts` | Google Calendar API + Microsoft Graph connectors (list/create/update/delete events) |
| `sync/http.ts` | Authenticated requests (host allow-list, 401 retry, readable errors) |
| `sync/builtin.ts` | Built-in app registrations (see Security) |
| `sync/setupGuides.ts` | The explanation texts of the sign-in dialog (text only) |
| `views/OmniView.ts` | Base of the three views: `queueRender`, `inSidebar` |
| `views/viewTypes.ts` | The view type ids |
| `views/CalendarView.ts` | Calendar / day planner, the frame only: toolbar, navigation, filter, responsive layout switch |
| `views/calendar/` | What the calendar draws: `month.ts` (grid + compact grid), `timeGrid.ts` (week/day, sideways-scrolling week), `agenda.ts`, `eventDrag.ts` (drag & drop of events **and tasks** + preview), `eventResize.ts` (drag an event's top / bottom edge), `slotSelection.ts` (press/drag to create, touch gestures), `ranges.ts` (range previews across day columns), `layout.ts` (sizes, overlapping events and tasks), `tasks.ts` (tasks in the calendar: time blocks, the per-day counter ☐ 3), `host.ts` (what they need from the view) |
| `eventLinks.ts` | `eventKey(occ)`: the stable key that tasks and linked notes of an event are stored under (`local:<id>`, `local:<id>@<date>` for one repeat, `<calendar>:<remote id>`, ICS occurrence key) |
| `views/eventExtras.ts`, `views/linkedNotes.ts` | The event's **Tasks** and **Linked notes** sections (event dialog + read-only details); the shared linked-notes block (also in the task dialog) |
| `views/eventDraft.ts` | The same sections in the **new-event** dialog: kept in memory, attached on Save (`attachDraft`) to the first saved copy |
| `modals/DayTasksModal.ts` | The day's tasks, opened from the counter in the calendar |
| `views/sideScroll.ts` | Bars that scroll sideways (settings tabs, Tasks list bar): faded edges, mouse wheel scrolls sideways; CSS `.ch-side-scroll` gives a thin always-visible scrollbar on desktop, none on phones. Chosen by the maintainer instead of arrow buttons (less space). The UI test browser hides scrollbars, so tests check `scrollbar-width` instead |
| `views/MiniCalendarView.ts` | Sidebar mini calendar |
| `views/AgendaBlock.ts` | The `omni-calendar` code block |
| `views/shared.ts` | Event chips, context menu (incl. linked notes, *Add task…*), open event, the "2/5" task hint, day-cell marking |
| `tasks.ts` | Task data layer (`TaskStore`): lists, smart lists, grouping/sorting, link rename/delete, `normalizeTaskData` |
| `views/TasksView.ts`, `views/tasks/` | Tasks page (`omni-calendar-tasks`): list nav (bar when narrow), groups, quick add; `tasks/taskRow.ts` (one task + its menu), `tasks/helpers.ts` |
| `modals/TaskModal.ts`, `ListModal.ts`, `NotePickerModal.ts` | Task dialog (priority, date, time range, subtasks, linked notes); list name + colour; vault note search with "create note" |
| `pickers/` | Own `DateField` (month calendar) and `TimeField` (15-minute list, typing); `popup.ts` has the shared pop-up helpers and `keepFocusOnTap` |
| `modals/EventModal.ts`, `eventForm.ts` | Create/edit dialog (local + remote, multi-calendar "Save to"); `eventForm.ts` fills its fields |
| `modals/SignInModal.ts` | Account connection (quick sign-in or own app registration) |
| `modals/EventDetailsModal.ts`, `modals/TaskDetailsModal.ts` | The details view (1.9) of events (also read-only ones) and tasks: everything at a glance, quick actions, **Edit notes** (`views/notesBlock.ts`), Edit button. They redraw on changes, but not while notes are being edited |
| `views/tasks/openTask.ts`, `openOccurrence` / `editOccurrence` in `views/shared.ts` | What a click opens (setting `clickOpens`: details / edit); right-click menus offer *Show details* and *Edit* |
| `modals/ConfirmModal.ts`, `confirmations.ts` | Yes/no and multiple-choice dialogs; the shared "delete event (with its tasks)" and "delete list" questions |
| `settings/` | Settings window: `SettingTab.ts` (tab bar), one file per tab (`calendarsTab`, `accountsTab`, `displayTab`, `tasksTab`, `notesTab`), `controls.ts` (`periodSetting`, `numberSetting`, calendar row) |
| `notes.ts`, `dateUtils.ts`, `periods.ts`, `util.ts` | Event notes + template; date helpers; period choices and wording; error text, plural, clamp |

CSS is in `styles.css`. Every class is prefixed `ch-`, and it uses Obsidian CSS variables only, so it supports light/dark mode and themes.

## Security rules (do not weaken)

- **Tokens** (refresh tokens, a user's own Google client secret) live **only in Obsidian SecretStorage**
  (`app.secretStorage`, Obsidian ≥ 1.11.4). They are never written to `data.json` or the vault, and never logged or included in errors.
  Without SecretStorage, connecting accounts is refused.
- OAuth: PKCE S256 + random `state` (constant-time compare). The loopback server is bound to 127.0.0.1 (and ::1 for Microsoft),
  accepts a single valid callback and has a 5-minute timeout.
- `sync/http.ts` only sends tokens over HTTPS to `www.googleapis.com` / `graph.microsoft.com`.
- Least-privilege scopes only: Google `calendar.events` + `calendar.calendarlist.readonly`; Microsoft `Calendars.ReadWrite` + `offline_access`.
- Remote edits and deletes use ETag `If-Match`. Remote deletes always ask for confirmation.
- **Built-in app registrations** (`sync/builtin.ts`):
  - Microsoft Entra app client ID `1e7d229a-9312-4a0b-a79b-1d5a9902c129`. It is public, multi-tenant + personal accounts,
    redirect `http://localhost`. The maintainer's Azure directory must **not be deleted**.
  - The Google OAuth desktop client is **never committed** (GitHub push protection blocks it). It is injected at build time
    from `OMNI_GOOGLE_CLIENT_ID` / `OMNI_GOOGLE_CLIENT_SECRET`, which are GitHub repository secrets used by the release
    workflow. Without them, Google quick sign-in is hidden.
  - Google app status: unverified (warning screen, 100-user cap) until the maintainer completes Google verification.
- No Omni Calendar server exists. Don't add one, and don't add analytics or telemetry.

## Things that must stay stable

- Plugin id **`omni-calendar`**. The name *Calendar Hub* / id `calendar-hub` was taken in the community store, which is why it was renamed.
- Ribbon icon title **"Omni Calendar"**. Obsidian identifies ribbon buttons by `pluginId:title`, so changing the title leaves
  duplicate buttons for users.
- View types `omni-calendar-view`, `omni-calendar-mini`, the code block language `omni-calendar`, and secret IDs
  `omni-calendar-<accountId>-rt|cs`.
- **Event links (1.8):** tasks point to an event with `task.event = { key, title, date }` (`eventKey()`). Linked notes of a local
  event are in `LocalEvent.links`; those of Google/Outlook/ICS events and of single repeats are in `data.eventLinks[key]`.
  Both are stored only in Obsidian, never sent to the providers. The old `notePath` is migrated into `links` on load.
  Tasks of an event without a time are not counted in the calendar's day counter (the event shows "2/5" instead).
  - **Deleting an event deletes its tasks** (after asking when it has any; `deleteEvent` in `modals/confirmations.ts`,
    `CalendarStore.keysForDelete`). Moving an event to another calendar re-keys its tasks and notes (`createRemote`
    returns the new key). Tasks whose event is gone are marked and offer keep-without-event / delete.
  - **Tasks follow their event's day** (`TaskStore.followEvents`, run on every `store` change): shifted by the same
    number of days, times kept. Not for repeats / ICS (keyed by their day).
  - **New-event dialog** collects tasks and notes in memory and attaches them on Save to the first saved copy only.
- `data.json` shape. When changing settings, add a migration in `normalizePluginData` (`settingsData.ts`; see `sidebarOnStartup` → `sidebarView`).
- Command ids (`commands.ts`). Users' hotkeys are stored by them; a test checks the list.

## Dialog and picker rules (learned from tablet bugs – don't regress)

- **Dates and times** in any dialog use the plugin's own `DateField` and `TimeField` (`src/pickers/`), never
  `<input type="date|time">`. Native pickers differ per device, and Android's clock dialog was cut off on a tablet.
  New date or time fields must use them too.
  - The `TimeField` list uses 15-minute steps. End fields get `after:` (times after the start, with durations).
  - On mobile the list opens without a keyboard; "Type a time" is offered on request.
  - Both follow `use24h` and `firstDayOfWeek`.
- **Focus:** Obsidian pulls the focus back to a dialog's first field (the title) when it leaves the dialog, which opens
  the keyboard on tablets. So:
  - pop-ups are created **inside** the `.modal-container` (`createPopup`) and never take the focus;
  - dialogs call `keepFocusOnTap(modalEl)`: buttons don't take the focus, and an active text field is released to the
    dialog itself, so the keyboard closes.
  - The UI tests simulate this focus trap. Keep those tests passing.
- Pop-ups use `z-index: calc(var(--layer-menu) + 1)` (Obsidian: modal layer 50, menu layer 65). The test page uses the same values.
- Task checkboxes have a fixed square size, because Obsidian's mobile button styles (padding, min-width) made them oval.

## Undocumented Obsidian internals in use (check first if something breaks after an Obsidian update)

| What | Where | Fallback |
| --- | --- | --- |
| `leaf.parent.selectTab(leaf)` to show a sidebar tab without opening the sidebar | `sidebar.ts` `selectTab` | `revealLeaf` on desktop |
| `leaf.updateHeader()` to refresh the tab title ("Calendar" ↔ "Day planner") | `CalendarView.updateLocationButton` | – |
| `app.setting.open()` / `openTabById()` for the menu's "Settings" entry | `main.ts` `openSettings` | – |
| `localStorage.getItem("language")` = Obsidian's app language (nothing stored = English), for *Language of dates* | `dateUtils.ts` `applyDateLanguage` | English |

## Sidebar behaviour (settings in Display)

- **Day planner ⤢** (`sidebarOnExpand`):
  - default: the planner's own tab turns into the mini calendar, in place (so Obsidian doesn't show another tab);
  - "close": optionally shows the sidebar tab chosen in `sidebarAfterClose`;
  - "keep".
- Settings changes never reveal or focus sidebar views, which would close the settings window. They select the tab
  quietly instead. Settings re-render keeps the scroll position.
- **Tasks in the sidebar** is a separate tab next to the mini calendar or day planner (`tasksSidebar`), not a toggle.
  This was the maintainer's choice.

## Keeping the built-in app registrations free (maintainer)

- **Azure (Microsoft sign-in):**
  - keep the spending limit on;
  - never upgrade to pay-as-you-go;
  - optionally set a budget alert;
  - **never delete the directory**, because the built-in client ID lives there.

  App registrations themselves cost nothing.
- **Google Cloud project:**
  - don't link a billing account and don't start the paid trial;
  - the Calendar API is free for this use;
  - the app is "unverified" (warning screen, 100-user cap) until the verification is done.

## Mobile notes (Obsidian Android/iOS)

- Plugins can't run in the background or send system notifications.
- Ribbon buttons on mobile only receive **taps**: no long-press and no right-click. A tap opens the calendar menu.
- Touch on the time grid: swipe scrolls, tap creates an event, long-press + drag selects a range. Handle `pointercancel` and
  never open more than one dialog (`EventModal.openCount`).
- iOS may not fire `contextmenu` on a long-press. Every action in a right-click menu (e.g. on tasks) must also be
  reachable by tapping, for example through the dialog.
- **UI names (use them everywhere, incl. tab titles via `getDisplayText`):** **Calendar** = full page in the main area, **Mini calendar** = `omni-calendar-mini`, **Day planner** = `omni-calendar-view` in a sidebar (setting value `full`; opens in `sidebarCalendarMode`, default Day). Avoid "full calendar".
- Narrow layouts:
  - month → compact 7-column grid (bars, or dots when very narrow) + the selected day's list (`renderMonthCompact` in `views/calendar/month.ts`);
  - week → the whole week, swiped day by day (`.ch-tg-hscroll`, header cells shifted via `--ch-sx`) with a week bar;
  - the settings tab bar scrolls sideways.

## Roadmap / open topics

- **Planned next feature: Tasks, in three releases (agreed with the maintainer; the full design is in the README roadmap).**
  Build them strictly step by step. The maintainer tests each release before the next one starts.
  - **Plugin-owned tasks only.** Never parse checkboxes from notes; that was rejected.
  - **Events stay events, but they can *have* tasks.** Tasks can also stand alone.
  - **Task fields:**
    - title, notes;
    - list, priority (none/low/medium/high);
    - optional date and optional time or time range (most tasks will have one);
    - subtasks, **one level only**;
    - done, plus an optional link to an event (local or remote ID + occurrence);
    - **linked notes:** several vault paths per task.
  - **Lists:**
    - user lists with a colour, like Microsoft To Do, plus a default list "Tasks";
    - automatic lists: Today, Tomorrow, Upcoming (`tasksUpcomingDays`, default 7), Overdue, No date, All, Done;
    - sorting is priority, then time;
    - event tasks also appear in the lists, marked with their event.
  - **Storage:** `data.json` → `tasks: { lists, items }`, next to `events`. This was changed from the "separate file" idea because it's unclear whether Obsidian Sync copies extra plugin files. Everything is validated in `normalizeTaskData`.
  - **Main switch:** "Tasks" on/off hides everything but deletes nothing.
  - **Naming:** the UI name is **Tasks** everywhere. Suggested view type: `omni-calendar-tasks` (full page + compact sidebar version).
    The sidebar toggle for Tasks is **separate** from the mini calendar / day planner.
  - **Calendar display must stay uncluttered:**
    - timed tasks as light blocks;
    - date-only tasks as **one counter per day** ("☑ 3");
    - done tasks struck through, with a setting to hide them.
  - **Linked notes (tasks and events):**
    - several existing notes can be linked via a fuzzy note picker, then listed and opened with a click;
    - notes are never parsed or modified;
    - update paths on vault rename/move, and drop them on delete.
    - Events: migrate the existing single `notePath` into the list. Remote events store their links locally, keyed by remote ID.
  - **1.7 (done):** Tasks page (full + sidebar), lists, task editing, subtasks, quick add, **linked notes on tasks**, Tasks settings tab, menu entry and commands.
  - **1.8 (done):** calendar integration, tasks on events (dialog section, "2/5" hint), **linked notes on events** (local + remote), "Tasks today" in the mini calendar. Tasks on a repeating event belong to the clicked repeat only; the "template" behaviour is 1.10 (renumbered: 1.9 became the details view).
  - **Details view = 1.9, built in steps (agreed): a) ✅ 1.9.0 – the view, Edit notes, quick actions, setting `clickOpens`;
    b) progress log; c) "Create note" + notes/descriptions for tasks and subtasks.** Clicking an event or task opens a large
    read-only view by default, with an **Edit** button for the edit dialog. It also needs a small **"Edit notes"**
    button: inline editing of only the event description or task notes (Save/Cancel), never triggered by just clicking
    the text. For remote events, save to Google/Outlook. Also confirmed by the maintainer:
    - quick actions in the view (tick off the task or a subtask, open linked notes);
    - a setting "Clicking opens: Details view (default) / Edit dialog directly";
    - right-click / long-press still offers Edit.
  - **Progress log for tasks (with the details view) – ✅ on `dev-branch` for 1.9.2:**
    - a task gets timestamped log entries (text + date/time), added via an input + send;
    - entries are shown oldest first, newest at the bottom, like sticky notes;
    - it's separate from subtasks;
    - also confirmed: adding entries in the details view (no Edit needed), a "📝 n" hint in lists, edit/delete of entries
      (the original time stays). Tasks first; the same log for events maybe later.
    - **Undecided (maintainer not sure it fits – don't build unless asked):** a log on events. Small way: only tracked
      events (log on the `self` task, shown in `EventDetailsModal`; `setTracked(false)` deletes that task, so it must ask
      first). Bigger way: a log on every event, stored per `eventKey` like `eventLinks`. Pick one, not both (README roadmap).
    - Store them in the task (e.g. `log: { at: number; text: string }[]`) and validate in `normalizeTaskData`.
  - **"Create note" for tasks (with the details view) – ✅ on `dev-branch` for 1.9.3:** the same as for events (`notes.ts` `createEventNote`).
    - It lives in the right-click menu, the task dialog and the details view.
    - Name: "YYYY-MM-DD Title" (or the title only if the task has no date), in `notesFolder`.
    - The note is added to `links` and opened; an existing note just opens ("Open note").
    - Own task note template in Settings → Notes.
    - **Subtasks too:** "Create note" (name "YYYY-MM-DD Task – Subtask") and linked notes per subtask.
      This needs `links: string[]` on `Subtask`, validated in `normalizeTaskData`, and included in link rename/delete.
      The progress log stays on the task only, unless the maintainer asks otherwise.
    - **Short optional description per subtask** (`description?: string` on `Subtask`). It **must stay uncluttered**:
      - task list: a small ≡ icon only;
      - details view: small grey text under the subtask;
      - dialog: an "add description" link that opens a small field on demand.

      Longer content belongs in a note.
  - **1.10 (was 1.9):** repeating tasks, per-occurrence tasks on repeating events, *Track as task* for repeats. A repeating task stays ONE item; completed occurrences are small "done on date" entries, not copies (agreed, to keep Done uncluttered).
  - **Completed tasks (1.7.5):**
    - Done shows the last `tasksDoneVisibleDays` (default 30, -1 = everything), with "Show older";
    - "Clear completed";
    - optional automatic delete after `tasksDeleteDoneAfterDays` (0 = never, the default).
    - Period settings use `periodSetting()` in `settings/controls.ts`. Use it for any new "how long / how far" setting.
      Every such setting must offer the **same** `STANDARD_PERIODS` (7d, 2w, 30d, 60d, 90d, 6mo, 1y), plus setting-specific extras and "Custom…". The maintainer asked for this uniformity, and a test checks it.
  - **Later:** Microsoft To Do sync (`Tasks.ReadWrite`, re-consent needed), Google Tasks, task reminders.
- **After Tasks: reminders and notifications.** See the README roadmap for the agreed design:
  - a reminder field and a default reminder;
  - desktop system notifications;
  - an in-app pop-up on mobile;
  - reminders stored in Google/Outlook for real phone notifications.
- Other ideas are in the README roadmap.

## Where we stopped (keep this section up to date at the end of a session)

**State:** everything up to **1.9.3** is merged and released (tags 1.8.0 … 1.9.3, PRs #28–#37). **1.9.3** (details view
step c – "Create note" for tasks and subtasks, subtask notes and descriptions, `taskNoteTemplate`, switch `tasksNoteExtras`)
is merged and released (PR #37, tag 1.9.3). `dev-branch` carries **1.9.4** (not released yet): the step c switch split
in two (`tasksNoteExtras` = main "Create note for tasks", `tasksSubtaskExtras` = "Notes and descriptions on subtasks");
switch `tasksOnEvents` ("Tasks on events": event Tasks section, *Add task…*, "2/5", tracked-event progress and the
"mark open tasks done?" question; off → untimed event tasks count in the day counter; check with `eventTasksOn(s)`);
`tasksHiddenLists` (hidden automatic lists, stored as the hidden ones; `visibleSmartLists(s)`; TasksView falls back to the
first visible one, or the default list). *Track as task* stays always on (maintainer: "it's just one button").

**Next on the roadmap (agreed order):**
0. **Lock the calendar ("view mode")** – agreed design, build next as its own step: blocks only accidental changes
   (dragging, resizing, tap/drag to create on the grid); clicking still opens details, *Edit* still works. **Not** a toolbar
   button (the toolbar is already full; the maintainer wants to clean it up later). Instead: an entry *Lock calendar /
   Unlock calendar* in the ribbon's Omni Calendar menu, a command (hotkey), and a small state icon next to the view's
   title (lock, or eye / pencil-book – ask which). Stored per device (not in the synced `data.json`).
1. **1.10** – repeating tasks, tasks on repeating events per repeat, *Track as task* for repeats.
2. Later: reminders and notifications (README roadmap), then the "Other ideas".
3. Undecided: a progress log on events (see the roadmap note above; only if the maintainer asks).

**Still to be tested by the maintainer on real devices** (only covered by the automated tests so far): creating a
Google/Outlook event with tasks in the new-event dialog (needs the real service to return the new id); moving events
with tasks between Obsidian and Google; multi-day drag to create; tasks following a moved event; the sticky label of
events that continue from the previous day; *Language of dates* with Obsidian in another language.

**What was built in 1.8.x–1.9.x (where to look):**
- 1.8.0: tasks in the calendar (`views/calendar/tasks.ts`, `DayTasksModal`), tasks and linked notes on events
  (`eventLinks.ts`, `views/eventExtras.ts`, `views/linkedNotes.ts`), *Tasks today* in the mini calendar.
- 1.8.1: subtasks shown in the event dialog; deleting an event deletes its tasks (`deleteEvent`, `keysForDelete`);
  moving an event keeps its tasks/notes; tasks and notes in the new-event dialog (`views/eventDraft.ts`).
- 1.8.2: tasks follow their event's day (`TaskStore.followEvents`); drag to create across days (`slotSelection.ts`).
- 1.8.3: timed multi-day events stay in the hour grid (sticky label, `.ch-tg-continues`); setting `multiDayTimed`.
- 1.8.4: resize events by their edges (`eventResize.ts`, `ranges.ts`); **Track as task** (see below).
- 1.8.5: tracked events show their tasks' progress and ask about open tasks (`toggleDone`); sideways bars with a thin
  scrollbar instead of arrows (`views/sideScroll.ts`).
- 1.9.0: details view (`EventDetailsModal`, `TaskDetailsModal`, `views/notesBlock.ts`), setting `clickOpens`.
- 1.9.2: progress log of tasks (`views/tasks/progressLog.ts`; `Task.log` = `{ id, at, text, editedAt? }[]`, oldest first,
  checked in `normalizeTaskData`; `TaskStore.addLog/editLog/removeLog`); shown in `TaskDetailsModal` only (not the edit
  dialog), "📝 n" in `taskRow.ts`. Setting `tasksProgressLog` (Tasks tab, on by default; the maintainer asked for a switch
  so it isn't overwhelming) hides both, deletes nothing. Enter sends on desktop, the button on phones.
- 1.9.3: step c. `createTaskNote` / `taskNotePath` in `notes.ts` (template `taskNoteTemplate`, placeholders title, task,
  subtask, date, time, list, priority, notes); `plugin.createNoteForTask(t, sub?, link?)` / `hasTaskNote`. `Subtask` has
  `links: string[]` + `description?` (checked in `normalizeTaskData`; `upsert` fills missing `links`); link rename/delete
  covers subtasks (`linkOwners`). Task dialog: ≡ button per subtask (`ch-sub-extra-btn`) opens description + notes – this
  replaced the "add description" link of the design; its *Create note* saves the task first. Details view: grey
  description, chips, ⋯ menu (`views/tasks/subtaskNotes.ts`). Lists: ≡ and note icons only (`taskRow.ts`).
  Switches (Tasks tab, both on by default; the maintainer asked for them because it may confuse some people):
  `tasksNoteExtras` "Create note for tasks" = main switch, off hides all of step c incl. the Notes tab's task template;
  `tasksSubtaskExtras` "Notes and descriptions on subtasks" (1.9.4, shown under it, **off by default** – maintainer's
  choice; tests that use it switch it on) hides only the subtask part. Check
  with `subtaskExtrasOn(settings)` (both on). Task-level linked notes (1.7) stay; nothing is deleted.
- 1.9.1: setting `dateLanguage` (all date formatting via `formatDate` / `dateLang()` in `dateUtils.ts`, never
  `toLocaleDateString(undefined, …)`); Microsoft sign-in hint for which page opens; README *Troubleshooting sign-in*.

**"Track as task":** `task.event.self = true` marks the task that *is* the event (`TaskStore.tracked` / `setTracked`;
`forEvent` leaves it out, so it isn't one of the event's "2/5"). Title, day and time mirror the event (`followEvents` +
`eventNowOf` in `store.ts`). Not drawn as a task block; the event gets `trackedMark` (tick circle, `ch-event-done`) in
`views/shared.ts`. In task lists a click opens the event; its menu has done / open event / stop tracking only (no
priority: not reachable by tapping). Off by default; not for repeats until 1.10.

**Decisions from the maintainer (keep them):**
- Subtasks on event tasks are shown in the event dialog (not forbidden). Event tasks stay separate tasks, **not**
  subtasks of a tracked event. Tasks of a deleted event are deleted with it (after asking).
- Event tasks go to the default task list; no list picker in the event's quick add (clutter).
- Timed events over several days: hour grid by default (like Outlook), all-day row as an option.
- Details view = 1.9, built in steps; repeating moved to 1.10.
- Sideways bars: thin scrollbar + mouse wheel on desktop, swipe on phones – **no arrow buttons**.
- UI tests run one at a time (no parallel runs). Testing happens after release, fixes go out as the next patch (no test builds).
- Dates follow Obsidian's language by default; the plugin's own words stay English (translating the plugin is not planned).
- The maintainer's **company Microsoft account** needs admin consent (company policy) and ICS publishing is disabled
  there; the guide covers this (README *Troubleshooting sign-in → Company or school accounts*). Don't try to bypass it.

**Tests:** the UI test setup starts with `clickOpens = "edit"` (most tests drive the edit dialogs); `specs/details.cjs`
switches back to the default. Topic files: `tests/README.md`.
