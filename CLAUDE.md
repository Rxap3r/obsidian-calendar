# CLAUDE.md – how we work on Omni Calendar

Omni Calendar is an Obsidian plugin (TypeScript, bundled with esbuild). It provides a full-page and sidebar
calendar, local events, two-way Google Calendar and Outlook / Microsoft 365 sync, and read-only ICS subscriptions.
It is installed by users via **BRAT** from GitHub releases. The user-facing documentation is `README.md`.
Read it for the feature set.

The maintainer (repo owner) tests on a **desktop computer and a phone** (Obsidian mobile) and prefers explanations in
plain language: what changed, why, and what to check. Avoid jargon. Be honest about what was and wasn't tested.

## Workflow rules (important)

1. **Branch:** always work on **`dev-branch`**. Before starting, update it from `main`:
   `git fetch origin main && git merge --ff-only origin/main` (or a normal merge if needed). Never push to `main` directly.
2. **Version bump with every user-visible change.** Update `manifest.json`, `package.json` and `versions.json` together
   (patch for fixes and small features, minor for bigger features). Run `npm install --package-lock-only` afterwards.
   A pull request whose version was already released needs a new number.
3. **Commit and push** to `dev-branch` after each finished change. Commit messages explain *why*.
4. **Pull requests only when the maintainer asks** ("pull it", "open a PR", …). Often several changes are collected
   first. Open the PR from `dev-branch` to `main`. The PR description has *Summary*, *Testing* (say clearly what was
   not tested on a real device or in real Obsidian) and *After merging* (`git tag X.Y.Z && git push origin X.Y.Z`
   or run the release workflow).
5. If the maintainer merged a PR, the next PR needs a new version number.
6. Keep `README.md` in sync with every feature or settings change (paths like *Settings → Omni Calendar → Display*).
   Ideas go into its **Roadmap** section.

## Build, test, release

```bash
npm install
npm run build        # type-check (tsc) + production bundle → main.js
npm test             # build + tests/sync (Node) + tests/ui (headless Chromium) – see tests/README.md
```

- **Always run `npm test` before committing.** For UI changes, also look at the screenshots in `tests/.out/shots/`
  and add or extend a test in `tests/ui/run.cjs`. Test **desktop and mobile** (`{ mobile: true }`) for any UI change.
- **Release:** pushing a tag equal to `manifest.json`'s version (no `v` prefix) runs `.github/workflows/release.yml`,
  which attaches `main.js`, `manifest.json` and `styles.css` to a GitHub release. BRAT installs from that.
- `main.js` and `dist/` are git-ignored build output.

## Architecture (src/)

| File | Purpose |
| --- | --- |
| `main.ts` | Plugin entry: views, commands, ribbon icon + calendar menu, sidebar logic (`applySidebar`, `syncSidebarSetting`), settings loading and migrations (`loadPluginData`), notes, .ics export, `omni-calendar` code block |
| `types.ts` | All data types (`OmniCalendarSettings`, `LocalEvent`, `CalendarSource`, `Account`, `CalendarOccurrence`, …) |
| `store.ts` | Data layer: local events + recurrence expansion, ICS fetching/caching, remote (Google/Outlook) events, writes (`createRemote`, `updateRemote`, `deleteRemote`, `moveOccurrence`), change events |
| `ics.ts` | ICS parsing via ical.js (time zones incl. Windows names, RRULE, exceptions), `.ics` export |
| `sync/oauth.ts` | OAuth 2.0 authorization code + PKCE, loopback redirect server, manual paste fallback, token refresh |
| `sync/accounts.ts` | Connected accounts, tokens in Obsidian SecretStorage, refresh, sign-out/revoke, calendar list → sources |
| `sync/providers.ts` | Google Calendar API + Microsoft Graph connectors (list/create/update/delete events) |
| `sync/http.ts` | Authenticated requests (host allow-list, 401 retry, readable errors) |
| `sync/builtin.ts` | Built-in app registrations (see Security) |
| `views/CalendarView.ts` | Full calendar: month (grid or day cards), week/day time grid (swipe mode when narrow), agenda, toolbar, drag & drop, touch gestures, responsive layout |
| `views/MiniCalendarView.ts` | Sidebar mini calendar |
| `views/shared.ts` | Event chips, context menu, open event |
| `modals/EventModal.ts` | Create/edit dialog (local + remote, multi-calendar "Save to") |
| `modals/SignInModal.ts` | Account connection (quick sign-in or own app registration, setup guides) |
| `modals/EventDetailsModal.ts`, `ConfirmModal.ts` | Read-only details, confirmations |
| `settings.ts` | Settings tab with four tabs: Calendars, Google & Outlook, Display, Notes |
| `notes.ts`, `dateUtils.ts` | Event notes + template, date helpers |

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
- `data.json` shape. When changing settings, add a migration in `loadPluginData` (see `sidebarOnStartup` → `sidebarView`).

## Mobile notes (Obsidian Android/iOS)

- Plugins can't run in the background or send system notifications.
- Ribbon buttons on mobile only receive **taps**: no long-press and no right-click. A tap opens the calendar menu.
- Touch on the time grid: swipe scrolls, tap creates an event, long-press + drag selects a range. Handle `pointercancel` and
  never open more than one dialog (`EventModal.openCount`).
- Narrow layouts:
  - month → day cards;
  - week → the whole week, swiped day by day (`.ch-tg-hscroll`, header cells shifted via `--ch-sx`) with a week bar;
  - the settings tab bar scrolls sideways.

## Roadmap / open topics

- **Planned next feature: reminders and notifications.** See the README roadmap for the agreed design:
  - a reminder field and a default reminder;
  - desktop system notifications;
  - an in-app pop-up on mobile;
  - reminders stored in Google/Outlook for real phone notifications.
- Other ideas are in the README roadmap.
