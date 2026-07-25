# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**MusicSync** — a React web app that streams music from Dropbox. An admin (the site owner) syncs Dropbox folders into playlists/collections; public visitors can browse and stream them without their own Dropbox account. Hosted on Firebase (Hosting + Functions + Firestore + Storage), project id `music-sync-99dbb`.

## Commands

```bash
npm run dev                # Vite dev server (port 5173)
npm run build              # Production build to dist/
npm run build:production   # Build with vite.config.production.ts (chunk splitting, no sourcemaps)
npm run lint               # ESLint over .js/.jsx/.ts/.tsx
npm run typecheck          # tsc --noEmit
```

There is no test suite yet (`npm run test:ci` is a placeholder echo). Verify changes with `npm run typecheck` and `npm run lint`.

Cloud Functions have their own package: `cd functions && npm run lint`, deploy via `firebase deploy --only functions`.

## Architecture

### Frontend (`src/`)

Entry: `src/main.tsx` → `src/App.tsx` (thin wrapper) → `src/AppRouter.tsx`, which splits the app into two worlds:

- **Public app** (`src/PublicApp.tsx`) — routes `/`, `/collection/:id`, `/playlist/:id`, `/public`. No login required; streams via server-managed Dropbox tokens.
- **Admin dashboard** (`src/AdminDashboard.tsx`) — route `/admin/*`, gated by Firebase Auth + the `useAdminRole` hook (admin role stored in Firestore). Admin components live in `src/components/admin/` (collection/playlist/folder-sync management, settings).

Shared UI is in `src/components/` and `src/components/shared/`. `GlobalAudioPlayer.tsx` + `useAudioPlayer.ts` implement the persistent player.

### Services layer (`src/services/`)

This is where most logic lives; components should go through services rather than hitting APIs directly:

- `dropboxService.ts` (~1000 lines) — all Dropbox SDK interaction: OAuth (PKCE, see `utils/pkce.ts`), folder listing, track fetching, temporary stream links.
- `tokenManager.ts`, `tokenEncryption.ts`, `keyRotation.ts`, `authErrorHandler.ts` — encrypted Dropbox token storage/refresh (AES-GCM, see `SECURE_ENCRYPTION_USAGE.md`).
- `publicTokenService.ts` / `publicDataService.ts` — how anonymous visitors get access: tokens are stored server-side (Firestore) and refreshed by the scheduled `refreshPublicTokens` function.
- `databaseService.ts` — Firestore reads/writes (collections, playlists, folder syncs); `localDataService.ts` is the legacy localStorage fallback.
- `cachedTrackService.ts`, `playlistPreloader.ts` — caching/preloading of track metadata and stream URLs.
- `firebase.ts` — Firebase app/auth/firestore initialization.
- `apiService.ts` — client for the Cloud Functions HTTP API.

### Backend (`functions/`)

Firebase Cloud Functions (Node 22, CommonJS, Google ESLint style):

- `index.js` — main codebase: callable functions (`syncDropboxFolder`, `getDropboxStreamLink`, `validateDropboxToken`, `listDropboxFolders`, `getTrackDuration`), scheduled jobs (`refreshPublicTokens`, `cleanupExpiredSyncs`), `dropboxWebhook`, and an Express `api` onRequest handler.
- `publicApi.js` — unauthenticated endpoints for public playback (`listFolders`, `getTracks`, `getStreamUrl`, `status`).
- `api.js` — older Express API variant.

### Data

- **Firestore** is the live database (rules in `firestore.rules`, indexes in `firestore.indexes.json`). Data model: users (with admin role), collections → playlists → tracks, folder syncs, public config/tokens.
- **Data Connect** (`dataconnect/`, PostgreSQL GraphQL schema) exists with a generated client in `dataconnect-generated/` (`@firebasegen/default-connector`), but Firestore is what the services actually use. `docs/DATABASE_SCHEMA.md` documents the intended relational schema.

### Config & deployment

- Env vars are Vite-style `VITE_*` in `.env.local` (Dropbox app key/secret, Firebase config). Never commit real secrets.
- `firebase.json` defines hosting targets `default` (production) and `staging`, functions, Firestore, storage, and App Hosting (`apphosting.yaml`).
- CI: `.github/workflows/deploy-production.yml`. `DEPLOYMENT.md` covers the full deploy process; `deploy.config.js` and `scripts/verify-deployment.js` support it.

## Repo Quirks

- `dropbox-music-sync.tsx` at the repo root is an old single-file prototype of the whole app — not imported anywhere; don't extend it.
- Root-level scripts `generate-refresh-token.js`, `quick-token-exchange.js`, `test-token.js`, `quick-fix.js`, and `debug-dropbox.html` are one-off Dropbox OAuth debugging utilities.
- `server/` is an empty directory; `README-Backend.md` describes an Express backend whose functionality now lives in `functions/`.
- There are duplicate Toast implementations (`components/Toast.tsx` vs `components/ui/Toast.tsx`, same for ToastContainer) — check which one a given import uses.
- The public/anonymous playback path (public tokens + `publicApi.js`) is the most sensitive area: changes to token handling can break the public site even when the admin flow still works.

## Docs Worth Reading

- `README.md` — feature overview and Dropbox app setup.
- `SETUP_REFRESH_TOKEN.md` — how the long-lived Dropbox refresh token is provisioned.
- `SECURE_ENCRYPTION_USAGE.md` — token encryption design.
- `docs/DATABASE_SCHEMA.md` — target relational schema.
- `DEPLOYMENT.md` — deploy runbook.
