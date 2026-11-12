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
- [ ] User design review before Phase 2.

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

## Phase 2 — Workout engine (not started)
- [ ] State machine and timestamp-based timer, preparation, deadline and pause accounting.
- [ ] Valid round timestamps, duplicate-tap protection, undo, scoring and partial validation.
- [ ] Refresh/background recovery and completion cues.
- [ ] Vitest coverage for requested engine scenarios.

## Phase 3 — Local data (not started)
- [ ] IndexedDB active and saved sessions, complete session schema.
- [ ] Real history, splits, configuration-matched PB and custom isolation.
- [ ] Validated JSON export/import and duplicate handling.
- [ ] Persistence, recovery and import tests.

## Phase 4 — PWA and deployment (not started)
- [ ] Manifest, icons, offline service worker and update behavior.
- [ ] iPhone Safari and installed-PWA checks; honest capability messaging.
- [ ] Playwright end-to-end coverage, deployment configuration and release checks.
