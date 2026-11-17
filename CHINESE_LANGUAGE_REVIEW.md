# English / Traditional Chinese interface

This local feature adds an EN / 繁中 switch in the header using the existing navy and white design. Traditional Chinese uses Hong Kong exercise terminology (e.g. 掌上壓). Cindy/Chelsea names and EMOM/AMRAP abbreviations remain recognizable. Simplified Chinese is not included.

## Behavior and data safety

- Navigation, Overview, workout controls and preparation cue, Custom EMOM setup, results, History/detail/deletion, notes controls, backup/import reports, charts, accessibility labels and PWA guidance are translated.
- Dates use Traditional Chinese formatting in Chinese mode. HTML language and browser title update with the setting.
- Preference is stored separately as `cindy-language` in localStorage and restored after reopening. It remains available offline after the app shell is cached. If preference storage is blocked, switching still works for the current page.
- Switching does not navigate or remount the workout. Preparation, active timers, pause state, round tracking and results drafts are retained.
- Workout engines, IndexedDB stores, backup schemas, PB calculations, volume, icons and manifest are unchanged. Notes and preset names remain exactly as entered, and exercise IDs/prescriptions stay canonical in exported JSON.
- Translation resources are bundled; no translation API, new dependency or network service is used. Unknown diagnostics fall back to English.
- Buttons are at least 44px. Small-screen header navigation is hidden to fit the language switch; the existing bottom navigation remains available.

## Verification

- 200 automated tests across 19 files pass (194 existing + 6 language tests).
- Tests cover both directions of switching, persisted/invalid preference, blocked preference writes, all mode CTAs, live preparation/round/pause state, Chinese results saving, notes editing, deletion Cancel, unchanged preset/session data, interpolation and validation.
- Production build and TypeScript pass.
- Chromium checks cover 320/375/390/430px layouts, equal benchmark-card heights and 44px language buttons.
- Cindy, Chelsea and Custom EMOM each pass Chinese start → five-second preparation → complete round/interval → switch languages → offline refresh/recovery → Chinese results/save → History → delete Cancel → English. Saved IDs, timestamps, volume and original notes are checked.
- Existing English mobile/offline/preset export/import workflow passes unchanged.
- Physical iPhone Safari/Home Screen installation, VoiceOver pronunciation, native text scaling and actual OS suspension still need manual testing; Chromium is not an iPhone.

## Local review on MacBook

Use Node.js 24. Extract `cindy-chinese.zip` into a separate folder, then from its `cindy-chinese` folder:

```sh
npm ci
npm test
npm run build
npm run dev
```

Open http://localhost:3000 and use EN / 繁中 in the header. Switch during an active workout and check that the timer and count persist. Reload to check the preference. Stored data is specific to the browser and origin; do not clear website data.

For mobile/offline browser checks, stop dev and use two Terminal windows in the same folder:

```sh
# Terminal 1
npm run build
npm start -- --port 3020
```

```sh
# Terminal 2
npx playwright install chromium
npm run test:language-browser
npm run test:custom-browser
```

The runners use isolated profiles and do not touch the records in your normal browser. Physical iPhone offline/PWA testing needs HTTPS; an HTTP LAN address is insufficient.

This language update is local on `feature/traditional-chinese`. It has not been pushed or deployed. Production remains the approved Phase 6.1 release until this update is approved for release.
