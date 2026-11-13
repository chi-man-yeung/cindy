# CINDY implementation checklist

## Phase 1 — UI with mock data
- [x] Inspect environment: empty workspace, Node 24, npm 11.
- [x] Create Next.js, TypeScript, Tailwind app; add Lucide and Recharts.
- [x] Home: workout definition, sample personal best, start preview.
- [x] Workout: static countdown, preview rounds/reps, round button, undo, pause/resume, finish dialog.
- [x] Results: partial reps (0–29), score preview, optional effort and notes, explicit save placeholder.
- [x] History: sample sessions, personal best, progress chart, expandable sample splits.
- [x] Responsive CSS, 44px controls, focus styles, native accessible dialog, reduced-motion rule.
- [x] Clearly distinguish mock data and UI state from real tracking.
- [x] Production build passed using `npm run build -- --webpack`; standalone TypeScript validation passed.
- [x] Vitest server-render smoke test passed (1 test). This does not verify browser interactions.
- [x] Use Webpack for dev/build because sandbox restrictions block Turbopack internal ports.
- [ ] Browser, touch, keyboard and iPhone Safari validation — browser tool unavailable.
- [x] User approved white/navy UI and authorized Phase 2.

## Phase 1 design revision — white and navy
- [x] Replace dark/neon palette with white #FFFFFF, navy #142D4E, secondary #EAF1F8, muted #64748B.
- [x] Restyle all four screens, inputs, dialog, navigation, chart and tooltip.
- [x] Refine rounded cards, whitespace, native system typography and tabular numerals.
- [x] Prioritize white timer canvas and large navy complete-round button.
- [x] Add viewport-fit and safe-area spacing; keep 44px controls and reduced-motion handling.
- [x] Check contrast: navy/white 13.86:1; muted/white 4.76:1; navy/secondary 12.17:1. Small copy on secondary surfaces uses navy.
- [x] Existing server-render smoke test passed; no workout behavior changes.
- [x] Revised production build passed, including TypeScript checks (`npm run build`).
- [ ] Visual and interaction checks on iPhone Safari and installed PWA; managed browser tool unavailable, PWA remains Phase 4.

## Phase 2 — Workout engine
- [x] Preserve the approved white/navy UI; bind workout/results to the live engine.
- [x] Pure state machine with idle, preparing, running, paused, completed; saved reserved for Phase 3.
- [x] Five-second 5/4/3/2/1/GO preparation and timestamp-based 20-minute timer.
- [x] Round timestamps, 30 reps/round, 600ms rapid-tap guard, undo, pause/resume and finish.
- [x] Exact deadline, suspended-browser resolution and input rejection at expiry.
- [x] Partial reps 0–29, validated scoring, effort/notes and results draft.
- [x] IndexedDB current-session recovery, serialized writes, runtime validation and visible storage errors.
- [x] Development-only 30-second mode with distinct configuration identity.
- [x] Optional foreground audio and visual completion cue; audio fallback tests.
- [x] 71 Vitest tests passed, including 14 DOM integration tests and 7 IndexedDB tests.
- [x] Final production build passed, including TypeScript, after accessibility/copy edits.
- [x] React review: synchronous event ref, cleanup of listeners/interval/audio, transactional persistence, accessible native dialog and results focus, no side effects in engine.
- [x] MacBook run/test instructions and manual device review checklist.
- [ ] Real iPhone Safari/audio/background behavior and browser E2E verification; browser tool unavailable.
- [x] User confirmed the Phase 2 engine works and authorized Phase 3.
- [x] Phase 2 remained unpushed; subsequent work is on local phase-3-history branch.

## Phase 3 — History, records and analytics
- [x] Preserve white/navy design and unchanged Phase 2 engine.
- [x] Migrate IndexedDB v1→v2, preserving active data; add saved sessions and deleted-ID stores.
- [x] Explicit Save workout, transactional saved-state marker, duplicate protection and saved-score lock.
- [x] Real newest-first history with date/time, duration, full/partial/total score, detail view and all available splits.
- [x] Single-record Delete inside detail; date/score confirmation, Cancel unchanged, persistent targeted deletion and no bulk delete.
- [x] Recalculate exact-configuration PB, counts, latest score, previous-comparable delta and chronological chart after changes.
- [x] Standard/custom/development isolation and useful empty/missing-split states.
- [x] Editable saved notes with transactional persistence and refresh recovery.
- [x] Versioned JSON export of all saved records; previewed merge-only import with duplicate/conflict/deleted-ID reporting.
- [x] Validation rejects malformed entries and unsupported envelopes; failed import rolls back atomically.
- [x] 117 automated tests passed across 8 files, including Phase 2 regressions, migration, history data and DOM flows.
- [x] Final production build and TypeScript checks passed after all source/CSS changes.
- [x] MacBook source archive and detailed local test instructions prepared.
- [x] React review: native dialog, bounded input, async errors, effect cleanup and memoized analytics; no new dependencies.
- [ ] Real Safari/iPhone file controls, chart rendering, layout and physical restart checks; browser tooling unavailable.
- [ ] User Phase 3 review and production release authorization.
- [x] No pushes, merges or deployments.

## Phase 4 — PWA and release (pending)
- [ ] Manifest, icons, offline service worker and update behavior.
- [ ] iPhone Safari and installed-PWA checks; honest capability messaging.
- [ ] Playwright end-to-end coverage, deployment configuration and release checks.

## Phases 3.1 / 4 / 5 release candidate
- [x] Audit: existing Phase 3.0 suite passed (117 tests).
- [x] Phase 3.1 exercise sequence, boundaries 0/1/5/6/15/16/29/30, full-round normalization, legacy compatibility and history breakdown; milestone 126 tests passed.
- [x] Phase 4 standalone manifest, navy/white metadata, C icon master and PNG sizes, Apple touch icon, deterministic offline shell and update lifecycle; milestone 128 tests and production build passed.
- [x] Phase 5 separate Chelsea scheduling, on-time minute input, missed/incomplete status, pause/resume, background expiry, results/history and separate performance groups.
- [x] Final full regression: 135 tests passed across 12 files.
- [x] Final production build and TypeScript checks passed, including service-worker emission and input-font adjustment.
- [x] Existing IndexedDB stores and records preserved; only additive session metadata; no destructive migration.
- [x] GitHub remote retained; Vercel build settings and cache headers prepared.
- [x] Local milestone commits; no push, merge or production deployment.
- [ ] Real browser offline/layout coverage: managed browser tool unavailable. VM/jsdom tests are not physical Safari verification.
- [ ] Physical iPhone Home Screen icon, standalone/offline launch, native file controls, audio, background behavior and upgrade verification.
- [ ] Explicit production release approval.

## Phase 5.2 — Navigation and UX refinement
- [x] Equal-width stretching mode cards, white/navy selected state and mode-specific Overview CTA.
- [x] Overview is the sole start flow; Workout tab opens the active workout or an explicit empty state.
- [x] Save commits history, clears only the finished draft, confirms success and returns to Overview.
- [x] Saved legacy draft markers are cleared on recovery; unsaved results remain reviewable.
- [x] Session-ID guards prevent duplicate/stale starts; replacing an active session or unsaved draft requires confirmation.
- [x] Both workout engines, icon and history schema remain unchanged.
- [x] Full regression: 142 tests passed across 13 files; production build and TypeScript checks passed.
- [ ] Physical iPhone card geometry and touch-flow review. Equal-grid layout is tested as a CSS contract, not actual browser geometry.

## Chelsea original-benchmark scoring refinement (local, not deployed)
- [x] Audit legacy fixed-EMOM engine and reps-only PB ranking.
- [x] New versioned Chelsea configuration: EMOM until the first missed timestamp deadline, then AMRAP on the same 30-minute clock.
- [x] Carry unfinished round through the transition; one tap records each subsequent complete round, with rapid-tap protection.
- [x] Final 0–29 sequential partial reps; clean 30/30 has no partial/AMRAP credit.
- [x] Persist on-time, post-transition and total rounds plus transition elapsed time; preserve timestamps and final partial reps.
- [x] PB comparison: consecutive on-time rounds, then total rounds, then partial reps; exact configuration isolation including scaled/custom IDs.
- [x] Preserve legacy record IDs/scores, active legacy sessions and legacy PB group without rewriting the database.
- [x] Extend current history/backup validation and display without changing the database schema.
- [x] Final regression: 157 tests passed across 14 files; production build and TypeScript checks passed.
- [x] No deployment or push authorized/performed for this refinement.
