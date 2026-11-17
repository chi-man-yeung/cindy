# CINDY — bilingual interface candidate

Adds an EN / 繁中 toggle with saved preference. See [CHINESE_LANGUAGE_REVIEW.md](CHINESE_LANGUAGE_REVIEW.md) for behavior, validation and local MacBook commands. This feature is not deployed.

# CINDY — Phase 6.1 local candidate

Latest local work adds Custom EMOM training, reusable presets with JSON backup/restore and training-only Completed Volume statistics. Cindy and Chelsea retain their existing engines. No Phase 6 deployment has been performed.

Download `cindy-phase61.zip`, extract it and follow [PHASE_6_REVIEW.md](PHASE_6_REVIEW.md) for current MacBook commands, automated offline-browser tests, migration details and remaining iPhone checks. Historical release instructions below refer to earlier archives.

# CINDY — local release candidate

Approved white/navy Cindy tracker with exercise-aware partial rounds, local history/backup, iPhone PWA assets and separate Chelsea 30-minute EMOM mode. Nothing has been deployed for this release.

## MacBook

Download `cindy-release.zip` from the chat, then with Node.js 24:

```sh
mkdir -p ~/Projects
unzip ~/Downloads/cindy-release.zip -d ~/Projects
cd ~/Projects/cindy-release && npm ci && npm test && npm run build && npm run dev
```

Open http://localhost:3000. Cindy is the default. Use the workout selector for Chelsea. The optional 30-second development mode applies only to Cindy. Chelsea uses its actual 30-minute schedule; automated tests advance the timestamp clock without waiting 30 minutes.

Stop dev with Control-C. For production/PWA checks use a **different origin/port** so a previously installed service worker cannot obscure development changes:

```sh
npm run build && npm start -- --port 3001
```

Open http://localhost:3001 online once and wait for Offline shell ready. Desktop localhost supports service workers; an iPhone accessing your Mac over plain LAN HTTP does not. Use an approved HTTPS test environment for physical installation checks. Keep using the same origin/profile to retain local records. Never clear IndexedDB to update the application.

## What to review

- Results: pull-ups first, then push-ups, then squats; all 30 convert to a round without an invented timestamp.
- History: saved notes, per-round splits, individual confirmed deletion, configuration-specific PB/chart and merge-only JSON backups. Existing/deleted IDs are never silently overwritten/restored on this device.
- Chelsea: minute 1–30, per-minute countdown, on-time completion, explicit incomplete, missed minutes, pause/resume, deadline and saved minute ledger. Current Chelsea switches to AMRAP at the first missed minute deadline. PB ranks consecutive on-time rounds, then total completed rounds, then partial reps. Legacy EMOM records stay separate and unchanged. Cindy records remain separate.
- Installed PWA: navy C monogram, standalone launch, initial online asset caching, offline workout and safe update behavior. Close all app windows to activate an installed update.

See [RELEASE_REPORT.md](RELEASE_REPORT.md) for tests, known limits, manual iPhone checks and deployment steps, and [CHECKLIST.md](CHECKLIST.md) for verification results. Earlier phase review documents are historical.


Latest local refinement: Chelsea standard v2 now follows EMOM → AMRAP benchmark scoring. See the final section of RELEASE_REPORT.md. This refinement has not been deployed.
