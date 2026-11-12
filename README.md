# CINDY

Phase 1 design prototype built with Next.js App Router, TypeScript, Tailwind CSS, Lucide, and Recharts.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Validation: `npm run build` and `npm run typecheck`.

## Review flow

Overview → Start workout → test round/undo/pause/resume → Finish → add partial reps and effort → Save placeholder. Open History and expand a session for illustrative splits.

All history and timer values are fixtures. Workout controls only update in-memory presentation state. Refresh resets the prototype. Saving deliberately displays a Phase 3 notice. No real workout engine, storage, authentication, tracking, PWA caching, or deployment has been implemented.

`components/` contains reusable presentation components; `lib/mock-data.ts` contains fixtures. Engine and persistence modules will be introduced after Phase 1 review. Vitest includes one passing server-render smoke test (`npm test`). Playwright is installed for later browser coverage; no engine or end-to-end tests exist yet. Dev/build use Webpack because this environment blocks Turbopack internal port binding.

Verified: production build with Webpack, TypeScript validation, and the server-render smoke test. Browser and iPhone Safari interaction/layout validation remain pending because the required managed browser tool is unavailable.

See [CHECKLIST.md](CHECKLIST.md) for progress and verification status.

## White and navy design revision

All four screens use white (#FFFFFF), navy (#142D4E), pale blue (#EAF1F8), and slate (#64748B). Primary controls use white text on navy. Small copy on pale-blue cards uses navy to meet contrast requirements. The chart, tooltip, inputs, native dialog, and mobile navigation share the same tokens. Safe-area spacing and `viewport-fit=cover` prepare the layout for iPhone display cutouts; installation and offline support remain scheduled for Phase 4.

## GitHub and Vercel

Source repository: https://github.com/chi-man-yeung/cindy

To deploy, import this repository in Vercel. Select Next.js, repository root (`.`), build command `npm run build`, install command `npm ci`, and the default Next.js output directory. Use Node.js 24.x. No environment variables are required by this prototype. Set the production branch to `main`.
