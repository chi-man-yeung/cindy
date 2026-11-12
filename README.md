# CINDY — Phase 3

Mobile-first Cindy tracking with the approved white/navy design, the existing Phase 2 workout engine, and real local history. No sample sessions are displayed.

## Run on your MacBook

Use **Node.js 24.x** and npm. Phase 3 is local to this workspace and is **not pushed or deployed**; GitHub `main` and the live Vercel site have not been updated. Download `cindy-phase3.zip` from this chat and extract this version first.

If the archive is in Downloads:

```sh
mkdir -p ~/Projects
unzip ~/Downloads/cindy-phase3.zip -d ~/Projects
cd ~/Projects/cindy-phase3 && npm ci && npm test && npm run typecheck && npm run build && npm run dev
```

Open **http://localhost:3000**. The `&&` chain stops on an error, including a failed `cd`, so npm cannot accidentally run in your home folder. Confirm you are in the right folder with `pwd` and `ls package.json`.

If you already copied this updated project to another directory, open that directory containing `package.json` and run:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Stop the server with **Control-C**. To check the production version locally:

```sh
npm run build && npm start
```

Use a separate browser profile for production checks if a development-only test session is still active. Development test mode is intentionally absent in production. With Homebrew already installed, Node 24 can be selected using:

```sh
brew install node@24
export PATH="$(brew --prefix node@24)/bin:$PATH"
node --version
```

## Quick review flow

1. In development, enable **30-second test mode** on Home, then Start. The five-second preparation and Phase 2 engine are unchanged.
2. Complete a few rounds, use Undo and Pause/Resume, then Finish or let the timer expire.
3. Add partial reps and notes on Results, then select **Save workout**. Repeated save attempts retain one ID. Saved scores become read-only; saved notes are edited in the detail view.
4. Open **History**, select the development configuration for analytics, then open a record. Check splits, edit notes and save them. Refresh and verify persistence.
5. Select **Delete workout** inside the detail. The confirmation displays the exact date/time and score. Cancel first, then confirm deletion; verify only that record disappears and analytics updates.
6. Use **Export JSON** and **Import JSON** in History. Import has a preview and explicit confirmation. Re-importing the same backup reports skipped duplicates rather than adding extra sessions.

Use a standard 20-minute session (you can Finish early for local review) to populate the standard Cindy personal-best card. Development/custom configurations remain separate.

See [PHASE_3_REVIEW.md](PHASE_3_REVIEW.md) for detailed validation and backup behavior.

## Data and architecture

- `lib/workout/engine.ts` is unchanged from Phase 2: timestamp timing, scoring, preparation, pause accounting, double-tap guard and undo.
- `lib/workout/storage.ts` migrates IndexedDB from version 1 to 2 without removing the active draft. It adds `sessions` and `deleted-sessions` stores alongside `active-session`.
- `lib/history/model.ts` validates canonical saved records, including stable ID, configuration, date/start/end, elapsed duration, full/partial/total score, round timestamps, pauses, effort and notes.
- `lib/history/repository.ts` provides transactional save, single-record delete, notes updates and merge-only import. Saving commits the active saved marker atomically with history. No bulk deletion API exists.
- `lib/history/analytics.ts` computes exact-configuration PB, newest-first ordering, latest/previous delta, chronological chart points and round splits.
- `lib/history/backup.ts` creates versioned JSON and validates backup input.
- `components/history.tsx` reuses existing card, stat, chart and dialog styles for records, details and backup controls.

## Backup rules

Import is **merge-only**, never replace. Exact duplicate IDs are skipped. Conflicting IDs keep the existing record and report the conflict. Within a file, the first valid record for an ID is retained and later repeats are reported. Malformed entries are rejected individually; a malformed/unsupported envelope rejects the entire file. Valid entries can be imported after preview confirmation. A write failure rolls back the merge transaction.

Deleted IDs are remembered on this device and skipped during import, so restoring an older backup does not silently resurrect deleted workouts. Tombstones are not part of the saved-workout export. A different device has no knowledge of this device's deleted IDs.

Imports accept version 1 backups up to **10 MB / 10,000 entries**. Missing round timestamps are represented as unavailable; split times are never invented. Optional missing notes/effort default to empty/null.

## Verification and limits

**117 automated tests pass**: 46 engine, 7 active-storage, 14 workout DOM integration, 3 sound adapter, 1 overview render, 37 history/data/analytics, 8 history DOM integration, and 1 database migration test. The production build and TypeScript checks pass. Tests cover saving/reopening, duplicate saves, atomic rollback, targeted deletion, deleted-ID persistence, notes edits, JSON round trips/merges/rejections, PB recalculation, chart data, configuration isolation, UI confirmations and empty states.

DOM tests use jsdom and fake IndexedDB. Recharts geometry is mocked in history UI tests; its data calculations are tested separately. Actual Safari rendering, iPhone downloads/file selection, audible cues and physical browser restart/suspension are not device-tested. Managed browser tooling is unavailable here. Playwright is installed, but browser E2E coverage remains pending.

Data belongs to one browser origin/profile. It survives ordinary refresh/reopen after the transaction commits, but is not synced across devices and is removed if browser storage is cleared. Keep JSON backups. PWA manifest, offline caching and installation testing remain Phase 4.

## Release status

Source repository: https://github.com/chi-man-yeung/cindy

Work remains on local branch `phase-3-history`; nothing has been pushed, merged or deployed. The source archive has no Git metadata. Vercel's connected repository automatically deploys pushes, so release requires a separate authorized step.

See [CHECKLIST.md](CHECKLIST.md) for completed and pending tasks.
