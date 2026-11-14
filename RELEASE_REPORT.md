# CINDY release candidate: Phases 3.1, 4 and 5

## Milestones

- Audit: all 117 existing Phase 3.0 tests passed before changes.
- Phase 3.1: sequential pull-up/push-up/squat inputs; trailing exercise counts reset when earlier work is reduced. 30 entered reps become one additional full round, with an explicitly unavailable timestamp. Original timed rounds are never fabricated or altered. New history exports include the normalized exercise breakdown; old records derive it from their score without a database rewrite. Milestone suite: 126 tests passed.
- Phase 4: standalone manifest, navy/white metadata, C monogram SVG and 1024/512/192/180 PNG assets, Apple touch icon, production-only service worker and deterministic build-generated asset list. Versioned cached HTML stays paired with its matching hashed chunks. Updates wait until all old app windows close; no forced reload interrupts a workout. Milestone suite: 128 tests passed; production build passed.
- Phase 5: independent Chelsea state machine using the shared timestamp clock. Thirty one-minute windows, one on-time completion per minute, explicit incomplete marks, automatic missed windows and unattempted future windows after early finish. A rendered minute identifier prevents late clicks from completing the next minute. Pause excludes wall time, suspension resolves all elapsed windows, and expiry is exactly 30 minutes. Chelsea results/minute ledger persist in the existing history/backup system and use a separate configuration/PB. Full regression result is recorded in CHECKLIST.md.

## Architecture and changed areas

- `lib/workout/partials.ts`, engine/results integration, validators and history canonical model: compatible additive partial-round fields.
- `lib/workout/chelsea.ts`: separate scheduling/transition engine and minute-ledger validation.
- `lib/workout/use-workout.ts`: selects and restores the appropriate engine, preserving existing serialized IndexedDB writes.
- `app/page.tsx`, `components/history.tsx`: selection, sequential inputs, minute clock and Chelsea results, within existing cards/colors/layout.
- `public/manifest.webmanifest`, `public/icons/`, `app/layout.tsx`, `components/pwa.tsx`: installability and icon metadata.
- `scripts/build-service-worker.mjs`, `scripts/service-worker-template.js`, `next.config.mjs`, `package.json`, `vercel.json`: offline build and deployment preparation.
- New partial, PWA and Chelsea tests; existing generic-input tests updated to exercise the replacement controls.

No IndexedDB store is dropped, no existing ID is changed, and no existing workout is rewritten on read. Schema version 1 exports remain accepted; new optional fields are validated and canonicalized. Older binaries do not understand Chelsea; do not restore a Chelsea backup using the old application.

## Automated verification scope

Vitest covers score boundaries 0/1/5/6/15/16/29/30, sequence rejection, normalization, serialization/IndexedDB retention, legacy history and PBs, manifest and PNG dimensions, service-worker install/offline-navigation behavior in a VM, all thirty Chelsea boundaries, late clicks, incomplete/missed minutes, pause/background/expiry, backup and a DOM save flow. Existing Cindy tests remain in the full regression suite.

These are unit, IndexedDB-emulation and DOM/VM tests. Browser tooling is unavailable in this managed environment. No real browser offline, chart layout, icon installation or Safari audio test has been executed. No claim of physical iPhone verification is made.

## Manual iPhone release checks

1. Serve the production build over HTTPS (or localhost for desktop tests), open online once and wait for Offline shell ready.
2. Safari → Share → Add to Home Screen. Confirm CINDY name, navy C icon, standalone launch and safe areas.
3. Airplane mode: close/reopen the installed app. Start Cindy, count a round, pause, resume, refresh and recover. Finish, save and inspect history. Also check notes, deletion and backup controls offline.
4. Repeat with Chelsea: complete minute 1, leave a minute unfinished, mark another incomplete, background across several minutes, then return. Check the ledger, countdown and full-duration expiry. Late input must not count against the preceding minute.
5. Check exercise partial boundaries including all 30 reps, refresh and save. Check standard Cindy and Chelsea PB isolation.
6. Verify real audio on/off, touch targets, chart rendering, native file download/import and persistent records after a full device restart.
7. Update test: install a newer candidate, keep an active workout open, confirm no forced reload; close all app tabs/windows, relaunch online, verify the new shell and preserved data.

Safari may suspend audio. Background alerts, vibration and wake lock are not promised. IndexedDB is origin/profile-local and can be removed by clearing browser data; use JSON backups. Offline use requires a successful initial online shell installation. HTTPS and accessible assets are required; Vercel login protection can affect first-load/install access and must be checked in the release target.

## GitHub and Vercel release gate

Repository remote remains https://github.com/chi-man-yeung/cindy.git. Local milestone commits are prepared; no push, merge, promotion or deployment was performed. Vercel is already linked to GitHub and may build on pushes.

After explicit production approval: push the reviewed branch, create/review a PR to main, verify Vercel build status and the intended team/project/commit, merge only after checks, then run the manual production smoke checks. Keep Next.js framework/root directory `.` and `npm run build`; the build also emits `public/sw.js`. Do not bypass team login protection without a separate instruction to change access.

## Final automated result

Full regression: **135 passing tests across 12 files**. Production build and TypeScript checks passed, with generated service-worker output. The final input-font adjustment is included in the passing production build. No known failing automated check remains. Browser/physical-device checks above remain outstanding, rather than being reported as passed.

## Phase 5.2

Balanced equal-grid mode cards now select the Overview CTA. Workout navigation never creates a session. Active sessions are preserved across navigation; replacement requires confirmation tied to the current session ID. Saving clears only the finished active draft after history commits, returns to Overview and shows a success message. Legacy saved draft markers are cleaned up on recovery. Unsaved results are accessible from Workout without adding another Start flow.

Both engine files, icons and the database schema are unchanged. Full regression: 142 tests passed across 13 files, including seven new navigation tests. Production build/TypeScript passed. iPhone layout geometry still requires physical/browser review; the automated layout check verifies equal CSS grid tracks and stretching only.

## Chelsea benchmark refinement — pending approval, local only

Audit found that legacy Chelsea (`chelsea-standard-v1`) always resumed minute-based work after misses and ranked by total reps. New sessions use `chelsea-standard-v2`, retaining the original five-second preparation and pause-aware 30-minute clock. At the first incomplete minute's deadline, the engine freezes consecutive on-time credit and continues as AMRAP. The next tap finishes the already-in-progress round; no progress or start timestamp is reset. Subsequent taps add complete AMRAP rounds. Partial reps 0–29 are captured at the end with the existing sequential exercise inputs.

New persisted `chelseaScore` metadata contains version, on-time rounds, post-transition rounds, total rounds and transition elapsed time. The existing record fields retain total reps, partial reps and all completion timestamps. PB comparison is lexicographic: on-time rounds → completed rounds → partial reps. Clean 30/30 is full completion. Exact configuration matching prevents standard/scaled comparison.

Compatibility is additive: there is no IndexedDB migration or rewrite of saved sessions. Legacy records and active sessions retain their v1 engine/scoring and are shown as Legacy EMOM, with their own PB group. This avoids inventing AMRAP activity that the old app never captured. Legacy JSON backups still import; new exports preserve the versioned metadata. Scaled/custom IDs stay outside the standard group. No scaled-workout builder was added.

UI changes reuse the existing timer, round button, pill and result/history cards. At transition the timer changes from minute time to total remaining time, the badge says AMRAP, and a quiet hint says to continue the unfinished round. Results/history show on-time, AMRAP and total completed rounds separately. Future EMOM slots are not presented as further attempts after the transition.

Automated coverage includes full 30/30; failure at minute 18 plus eight AMRAP rounds (17 on-time + 8 = 25 complete rounds); final boundary and partial reps; pause/refresh/background expiry; rapid taps; PB tie-breaks; legacy/scaled isolation; history/notes/deletion; JSON round trips and malformed metadata; and a DOM flow through transition, final partials and saving. Real iPhone audio/background behavior remains a manual check. No production deployment is performed without approval.

Final verification for Chelsea refinement: **157 tests passed across 14 files**, production build/TypeScript passed, and git diff whitespace checks passed. Test cleanup now awaits queued retention before unmount. No known automated failure remains; physical iPhone checks are not represented as tested.

## Phase 6 — Custom EMOM training (not deployed)

A separate targeted-training mode adds configurable fixed intervals and exercise prescriptions, named presets, timestamp-derived completion/miss tracking, early/incomplete saving and training-only history/volume statistics. Cindy and Chelsea engine behavior is unchanged. IndexedDB v3 adds a preset store without resetting records. Older workout backups remain supported; custom-containing exports use version 2 to prevent old readers losing the interval metadata. No training records are ranked as benchmarks.

Verification: 189 automated tests passed, production build/TypeScript passed, mobile Chromium bounds/target checks passed at 320–430 px, and isolated offline browser tests passed for preset reuse, startup, refresh recovery, deadline resolution and saving. See PHASE_6_REVIEW.md for exact semantics, file changes, data limits, backup/preset limitations, MacBook commands and remaining physical iPhone checks.

## Phase 6.1 — Release polish (local only)

Preset-inclusive version-3 JSON backups, version-1/2 import compatibility, strict validation, duplicate/conflict reporting and atomic merge without overwrites.
Completed Volume terminology explains successful intervals only; calculation and workout engines unchanged.
194 tests across 18 files, production build/TypeScript and mobile/offline Chromium workflows passed. Preset export, restore, refresh reuse and duplicate/conflict protection verified.
Physical iPhone Safari/Home Screen PWA review remains manual. No push or deployment; release awaits approval.
