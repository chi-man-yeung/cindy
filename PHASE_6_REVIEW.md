# Phase 6.1 — Custom EMOM release candidate (local only)

## Behavior

Custom EMOM is a third Overview option. Cindy remains the default. Setup appears only when Custom EMOM is selected, preserving the established white/navy controls and the benchmark flows.

- Duration: 5–30 whole minutes. Interval: 60 or 90 seconds.
- Every interval contains **all selected exercises in the configured order**, as confirmed by the user. Up/down buttons reorder exercises; Add and Remove change the list.
- Supported movements: pull-ups, push-ups, squats, sit-ups, burpees and lunges. Lunges are counted as total reps. Limits are 1–12 exercise entries and 1–1,000 prescribed reps per entry.
- Setup displays the entire prescription, interval count and final-interval length before Start. If the workout duration does not divide evenly by 90 seconds, the final interval is shortened to the global workout deadline (e.g. 5 minutes = 3 × 90 seconds + 30 seconds).
- The shared five-second preparation, timestamp clock and pause accounting are reused. Completion is one tap per interval; duplicate taps and delayed taps referring to an earlier interval are rejected. Missed windows are derived from timestamps; the clock and targets never reset or increase.
- Early Finish marks the current unfinished interval incomplete and future intervals not-started. Completed intervals retain their timestamps. The resulting session can be saved immediately.
- Completion rate is completed / planned intervals, including future unattempted intervals in the denominator. Recorded volume is completed intervals × prescribed reps per interval. Unfinished interval reps are not estimated or logged.

## History and presets

Saved training records retain the full immutable configuration, exercise order/reps, interval length, duration, completion timestamps and complete interval ledger. Detail view shows each interval and recorded volume; notes/deletion use the existing transactional APIs. Training statistics show count, latest volume, planned-denominator completion rate and total volume. Training is excluded from benchmark comparison functions, PB badges, Cindy PBs and Chelsea PBs.

Presets are separate device-local objects with a name, stable ID, configuration and creation/update timestamps. Selecting a saved preset restores its full setup. Save preset creates a new preset; Update preset explicitly updates the selected preset. No automatic difficulty progression exists. Existing active sessions own cloned configurations, so editing a preset cannot alter an in-progress workout.

The IndexedDB version increases **2 → 3**, adding only a `presets` store. Existing active sessions, saved sessions and deleted-ID markers remain in place. No store or record is dropped or rewritten by the migration. Old version-1 databases also upgrade additively. Close other CINDY app windows before upgrading if a blocked-upgrade message appears. Do not clear browser data to update.

## Backup compatibility

The app continues reading version-1 workout backups. Exports without presets remain version 1 (benchmarks only) or version 2 (with Custom EMOM). Exports containing presets use a **version-3 envelope**, including all saved workouts and presets. Phase 6.1 reads versions 1, 2 and 3. This prevents an older app from silently dropping training fields. Existing merge-only duplicate/conflict/deleted-ID behavior remains intact.

The saved-record schema remains version 1 with optional typed training fields; custom configurations/intervals receive strict runtime validation. Presets are included in JSON exports, preserving their IDs, names, configurations and timestamps. Imports validate presets and merge new IDs only. Identical IDs are skipped; conflicting IDs keep the existing local preset and are reported. Same-name presets with distinct IDs are retained. Preset-only backups can be imported. Malformed entries are rejected individually and reported. Workout and preset writes commit atomically; a write failure rolls back the entire merge. Older files without presets leave the preset library unchanged. Version-3 backups require Phase 6.1; production has not been updated yet.

## Verification

- Full automated suite: **194 tests across 18 files passed**. The original 157 tests still pass. Five additional tests cover preset backup round trips, duplicate/conflict handling, malformed presets, legacy backups, persistence after reopen and atomic rollback.
- New tests cover setup limits/order, 60/90-second boundaries, duplicate/stale taps, misses/suspension, short final windows, exact expiry, early Finish, paused-time recovery, presets/reopen/update failure, history/notes/deletion, backup version 1/2, forged data, training exclusion from PBs, and v2→v3 migration preserving old active/saved/deleted data.
- Production build and TypeScript checks pass. The initial restricted-sandbox build could not parse the TypeScript subprocess output; rerunning with process permissions passed.
- Chromium: 320/375/390/430 px viewports passed control bounds and 44px target checks.
- Chromium preset backup export/restore, repeat import, conflict protection and post-refresh reuse passed in isolated profiles.
- Chromium offline flow passed: install cached shell online → go offline → reload → reuse preset → start → complete interval → advance across missed windows → reload active workout → expire → save offline → view training analytics with no PB.
- Source-level comparison confirmed all existing Cindy engine functions except the training-aware configuration-key helper remain identical; the complete Chelsea engine file is identical. Existing benchmark configuration keys are unchanged.

Physical iPhone Safari/Home Screen installation, native text sizing and keyboard ergonomics, audible cues, real device suspension/restart and offline upgrade behavior still require device review. Chromium emulation and simulated clock advancement are not physical iPhone verification.

## MacBook instructions

Use Node.js 24. Download `cindy-phase61.zip` from the chat, then:

```sh
mkdir -p ~/Projects
unzip ~/Downloads/cindy-phase61.zip -d ~/Projects
cd ~/Projects/cindy-phase61 && npm ci && npm test && npm run build && npm run dev
```

Open http://localhost:3000. Select Custom EMOM, enter the setup, save/reuse a preset, Start, then Finish and Save to check the flow quickly. History's configuration selector shows training-only statistics. Starting another workout after Save returns through Overview.

For production/offline/browser verification stop dev first, use a different origin from your usual development app, and run in one Terminal:

```sh
npm run build && npm start -- --port 3020
```

In another Terminal, from the same project folder:

```sh
npx playwright install chromium
npm run test:custom-browser
```

The runner defaults to http://127.0.0.1:3020 and uses isolated browser contexts, so it does not access your normal browser's records. Optional `CINDY_TEST_URL` overrides the URL and `CINDY_CHROMIUM_PATH` selects an installed executable. Results are written to `/tmp/cindy-custom-browser-results.json` by default. Offline use requires one successful online service-worker installation first; plain HTTP on an iPhone's LAN address is insufficient, so use an approved HTTPS test deployment for physical PWA review.

No code has been pushed or deployed for Phase 6. The existing production deployment remains unchanged until approval.

## Phase 6.1 terminology

Training results, Overview totals, History and analytics use **Completed Volume**. Only successfully completed intervals contribute to recorded volume. Missed, incomplete and unstarted intervals add no volume. This is a wording change only; no timer, scoring, volume calculation or database migration was introduced in Phase 6.1.
