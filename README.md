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
- Chelsea: minute 1–30, per-minute countdown, on-time completion, explicit incomplete, missed minutes, pause/resume, deadline and saved minute ledger. Scores count only on-time completed minutes. Cindy records remain separate.
- Installed PWA: navy C monogram, standalone launch, initial online asset caching, offline workout and safe update behavior. Close all app windows to activate an installed update.

See [RELEASE_REPORT.md](RELEASE_REPORT.md) for tests, known limits, manual iPhone checks and deployment steps, and [CHECKLIST.md](CHECKLIST.md) for verification results. Earlier phase review documents are historical.
