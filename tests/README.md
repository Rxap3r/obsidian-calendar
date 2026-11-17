# Tests

Two automated test suites. Neither needs Obsidian, a real phone, or real Google / Microsoft accounts.

```bash
npm test            # build + both suites
npm run test:sync   # sign-in (OAuth/PKCE) and Google / Outlook connectors – Node only
npm run test:ui     # views, dialogs, settings, touch gestures – headless Chromium
npm run test:ui -- tasks    # one topic file (see below): data, calendar, calendartasks, details, events, sidebar, settings, pickers, tasks
npm run test:ui -- mobile   # only UI tests whose name contains "mobile"
```

Requirements: `npm install`, plus **Playwright with Chromium**. In Claude Code's cloud environment it is
pre-installed. Locally you can use `npm i --no-save playwright && npx playwright install chromium`.
On GitHub, every push runs both suites (`.github/workflows/ci.yml`); screenshots of failed tests are attached to the run.
The downloaded test browser is kept in GitHub's Actions cache between runs (not in the repository); its version is set in `ci.yml` in two places.

## `tests/sync/` (Node)

- `sync.test.ts` covers the following, against simulated provider responses:
  - PKCE S256 challenge and verifier;
  - a random `state` that rejects forged or foreign responses;
  - the loopback server: GET `/` only, closes after use;
  - the manual paste flow;
  - token errors without leaked secrets;
  - no tokens sent to non-provider hosts or over plain http;
  - one retry with a refreshed token after a 401;
  - Google and Graph event mapping (time zones, all-day, series instances, cancelled);
  - request bodies (RRULE / Graph recurrence) and the `If-Match` ETag on update and delete.
- `obsidian-mock.ts` is a tiny stand-in for `requestUrl` / `Platform`.

## `tests/ui/` (browser)

- `entry.ts` boots the **real plugin** against `obsidian-mock.ts`, which is a stand-in for the parts of the
  Obsidian API the plugin uses. It also creates fixtures:
  - local events around "today";
  - a *Work* calendar;
  - `fixtures.ics`, a subscription with time zones, exceptions, EXDATE and a cancelled event;
  - a fake signed-in Google account with a writable and a read-only calendar.
- `run.cjs` is the test runner (shared setup, helpers, runner). Each test gets a fresh page.
- **The tests themselves are in `specs/`, one file per topic:**

  | File | Covers |
  | --- | --- |
  | `data.cjs` | ICS parsing, local recurrence, loading and checking settings and task data |
  | `calendar.cjs` | month/week/day/agenda, drag & drop, touch, narrow layouts, month times |
  | `events.cjs` | event dialog, Google/Outlook edits, several target calendars, all-day edge cases |
  | `sidebar.cjs` | mini calendar, day planner, sidebar settings, ribbon menu |
  | `settings.cjs` | settings tabs and tab bar, scroll position, period settings, deleting calendars, commands |
  | `pickers.cjs` | own date/time pickers, dialog focus rules (tablet keyboard bugs) |
  | `tasks.cjs` | Tasks page, task dialog, lists, completed tasks, tasks sidebar, notes for tasks and subtasks (1.9.3) |
  | `details.cjs` | 1.9: details view of events and tasks, *Edit notes*, the *Clicking opens* setting, right-click entries, the progress log of tasks (1.9.2), subtask descriptions and notes in the details view (1.9.3) |
  | `calendartasks.cjs` | 1.8: tasks on events ("2/5"), linked notes on events, tasks in the calendar (blocks, day counter, drag), *Tasks today* |

  Add new tests to the matching file. Make a new file only for a genuinely new topic; it's picked up automatically.
  To save tokens, only open the file you need.
  - **Time is frozen at 2026-11-14 10:00 Europe/Zurich**, so results are reproducible.
  - Clicking an event or task opens the **edit dialog** in the tests (`clickOpens = "edit"` in `entry.ts`); `details.cjs`
    switches back to the default, the details view.
  - Desktop tests run at 1400×900. Mobile tests use a 390×800 touch device (`{ mobile: true }`), which also sets
    Obsidian's `Platform.isMobile`.
  - Touch gestures are sent with real CDP touch events.
- Screenshots of key screens go to `tests/.out/shots/`. That folder is git-ignored. Look at them after UI changes.
  Failing tests also save a `FAIL-*.png`.

### Writing a new UI test

Each spec file exports `({ test, expect, eq, settle, shot, path, SHOTS }) => { … }` and registers its tests inside:

```js
test("mobile: my feature", { mobile: true }, async ({ page, ctx }) => {
	await page.evaluate(() => view.goTo(new Date(2026, 10, 14), "week"));
	await settle(page);
	eq(await page.locator(".ch-tg-col").count(), 7, "columns");
});
```

- **Waiting:** after a click or a change, use `await settle(page)`. It waits until the plugin has redrawn, which is
  faster than a fixed pause. Keep a real pause (`page.waitForTimeout(…)`) only where the plugin has its own timer:
  drags, touch gestures (long press 400 ms), scrolling (150 ms) and the sidebar (300 ms).
- **Desktop and mobile:** test the phone (`{ mobile: true }`) when the layout, tapping or touch matters.
  If a check doesn't depend on the screen (data, wording, a setting's logic), one test is enough. When both are
  needed and the phone test checks everything the desktop one does (it taps and checks that it fits), the phone test alone is enough.

Globals in the page:
- `plugin`, `view` (calendar), `mini` (mini calendar), `tab` (settings tab);
- `ws` (fake workspace with `leaves`, `fireLayoutChange()`, `tabGroups`, `reveals`);
- `lastModal`, `lastMenu`, `notices`, `__Platform`;
- **tasks:** `mountTasks({ side? })` creates a Tasks page in `#main` or `#side` and sets `tasksView`; `TaskModal`;
  `vaultNotes` (fake notes for linking); `openedFile` (the last note opened);
- **modules:** `__timeMod` (date/time pickers, `parseTimeInput`), `__eventMod` (`EventModal`), `__dateMod` (date helpers);
- **plugin parts:** `plugin.sidebar` (sidebar placement), `plugin.commands` (the registered commands, to run or check them).

The test page uses Obsidian's real layer values: modal 50, menu 65.
Some tests imitate Obsidian's dialog focus trap: focus that leaves the dialog is pulled back to the title. Use them
for any change to dialogs or pop-ups.
If the plugin starts using a new Obsidian API, add it to `obsidian-mock.ts`.

### Limits

These tests simulate Obsidian and the browser. They can't show:
- real Obsidian layout or theme details;
- real phone scrolling physics (bounce, momentum);
- Obsidian mobile's own ribbon / toolbar handling;
- real Google / Microsoft sign-in.

Mention these in PRs ("not tested on a real device / in real Obsidian") and ask the maintainer to try them.
