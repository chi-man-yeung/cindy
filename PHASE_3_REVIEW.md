# Phase 3 local review

The design and Phase 2 timer engine are preserved. Start with the README commands and keep the browser on the same `http://localhost:3000` origin/profile when testing persistence. Data is stored in the browser, not the source-code folder.

## Save, history and notes

- Complete a development 30-second workout, add partial reps and notes, then Save workout. The saved marker and history record commit together. Repeated clicks cannot create extra IDs.
- Saved results lock full-round/partial scoring; open History to edit notes.
- History is newest-first by full date/time. Each row shows configuration, date/time, elapsed duration, full rounds, partial reps and total reps.
- Open a record to view every round's split and elapsed timestamp, notes, effort and completion reason. Missing split data says Unavailable.
- Edit notes, Save notes, refresh, and check the edited value.
- Stop/restart the dev server or quit/reopen the browser, then check the same origin/profile. Existing IndexedDB version-1 active data migrates without being removed.

## Single-record deletion

- Save at least two records, ideally on the same date with different scores.
- Open one record and select Delete workout. Verify the exact date/time, score and configuration in the confirmation.
- Select Cancel. The detail and record must remain unchanged.
- Confirm deletion. Only that stable ID is removed; other records must remain. The selected configuration's PB, count, latest score, delta and chart recompute immediately.
- Refresh and verify the record remains absent. There is no bulk delete control.
- Import an older backup containing its ID: it should report Deleted IDs skipped, and the record must remain absent on this device.

## Configuration-aware analytics

- Home PB uses only the exact standard 20-minute configuration.
- History's configuration selector controls statistics and chart; the list below still contains all saved configurations.
- Development/custom records do not improve the standard PB. Latest/previous change compares only the selected configuration.
- No comparable workouts: count 0 and score placeholders. One workout: previous delta unavailable. Tied PBs select the newest record deterministically.
- The chart uses each workout's date/time and total reps, ordered chronologically, with a score axis starting at zero. It does not aggregate separate sessions on the same day.

## Export/import

- Export JSON downloads all saved records, across configurations; it excludes the active unsaved workout and deleted records.
- Import a backup, inspect valid/rejected/repeated counts, then Cancel import: no data should change.
- Re-select the file and Confirm import: new IDs are added. Exact duplicates are skipped, conflicts keep the existing record, and locally deleted IDs stay deleted. Existing notes and scores are never silently overwritten.
- Malformed entries are rejected individually and listed in validation details; other valid records may be confirmed for import. An invalid envelope, unsupported version, invalid JSON, or size/count limit rejects the entire file.
- Import is one transaction: if a write fails, no subset is retained.
- Limits are 10 MB and 10,000 entries. JSON version 1 is the supported backup contract. Nothing is imported automatically or synchronized remotely.

## Remaining device checks

Automated Vitest coverage includes data, migration and DOM workflows; it does not verify actual browser layout or real file-download/chooser behavior. On Mac Safari and iPhone Safari, verify:

- Existing white/navy layout, safe areas, large timer and 44px controls.
- Native dialog focus, keyboard Escape/Cancel, and confirmation date/score readability.
- Recharts rendering for 0, 1 and multiple sessions, and tooltips on touch.
- JSON download/file selection and restart persistence on the actual browser.
- Five-second countdown, audio optional/on/off, refresh and background expiry of the unchanged Phase 2 engine.

There is no PWA service worker or offline installation support yet. Those remain Phase 4. No code was pushed or deployed for this phase.
