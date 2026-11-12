> Historical Phase 2 handoff. Phase 3 is now implemented; use README.md and PHASE_3_REVIEW.md for current instructions.

# Phase 2 review and Phase 3 handoff

## Manual checks still required

Run `npm run dev`, then review in a browser:

1. Enable the development-only 30-second option. Optionally enable sounds. Start and verify 5, 4, 3, 2, 1, GO; round input is disabled during preparation.
2. Tap complete round once; verify 1 round / 30 reps. Tap twice rapidly; verify only one additional accepted round. Wait at least 600ms between deliberate inputs.
3. Undo; verify only the latest timestamp/round is removed. Pause, wait, then resume. The countdown must exclude the pause.
4. Refresh during preparation, running and pause. Wait until the page says changes are retained before deliberately testing a refresh; an abrupt process kill can interrupt an uncommitted browser transaction.
5. Background the tab beyond the 30-second deadline. On return, expect Results with 0:30 elapsed. No timer input is accepted at or after the deadline.
6. Add partial reps 0 and 29; verify score. Try 30 or a negative value; verify the input clamps to its legal range. Add effort/notes, refresh and verify the draft returns.
7. Start another workout. Cancel the confirmation first; verify the draft remains. Confirm replacement; verify a fresh five-second preparation and zero rounds.
8. Disable test mode and verify the standard timer starts at 20:00. Test mode must be absent under `npm run build && npm start`.
9. On iPhone Safari, verify countdown visibility, safe areas, controls, keyboard focus/dialogs and audio enabled/disabled. Foreground sound is best effort. Background notifications, vibration and wake lock have not been implemented or promised.

Automated jsdom/fake-IndexedDB integration verifies behavior but does not establish physical Safari sound, browser suspension or layout behavior. PWA installation/offline checks wait for Phase 4. No deployment is performed as part of Phase 2.

## Phase 3 data contract (prepared, not implemented)

`WorkoutSession` is versioned and includes stable session ID, ISO date, full configuration, lifecycle status, completion reason, preparation/start/end timestamps, elapsed duration, closed pause intervals and any open pause, ordered round elapsed timestamps, partial reps, total reps, optional effort and notes. `saved` is reserved for actual history commits. Structural configuration identity includes duration, exercises, rep scheme and preparation duration; test/custom configurations cannot match standard Cindy records.

The current IndexedDB version has only an `active-session` object store with one `current` slot. Phase 3 will migrate the same database with a separate `sessions` store keyed by session ID; clearing/cancelling the active slot must never touch history.

### Individual deletion

- Place Delete inside the selected record's detail view only. No bulk delete in V1.
- Capture its stable ID when opening confirmation. Show that record's formatted date AND full-round/partial/total score.
- Cancel performs no write. Confirm deletes only that ID in a transaction.
- Wait for commit, then re-query history, recompute the best for the identical configuration, and regenerate charts. Keep other records intact. Reload must not restore the deleted record.
- Test deletion of both best/non-best records, cancel, storage failure, duplicate dates with different IDs and refresh.

### JSON export/import

The planned envelope is `WorkoutHistoryExport` with schemaVersion, exportedAt and sessions. Implement strict envelope/session validation before writing. Export saved history only; exclude the active session. Enforce scoring, state and timestamp invariants on imported records.

Import must preserve stable IDs: skip exact duplicates and retain the existing record for a conflicting ID, reporting both outcomes. Never silently overwrite a record. Show accepted/skipped/conflicting/rejected counts and reasons. Invalid/unsupported files must not alter history. Re-importing an old export can intentionally reintroduce a previously deleted ID; show that clearly before import confirmation rather than silently restoring it. No automatic sync or background import.

History, personal-best selection, analytics, export/import execution, deletion UI and their tests are all deferred to Phase 3. Existing History/PB UI remains illustrative sample data.
