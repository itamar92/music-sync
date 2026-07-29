# Collection Share Links — Design Spec

**Date:** 2026-07-28
**Status:** Approved for planning
**Scope:** Container mode only (Express + Postgres backend in `server/`, `VITE_DATA_MODE=server` frontend). Firebase mode is unaffected.

## Problem

The admin wants to send a link to a single collection to a specific person without that person gaining access to the full catalog. Today a collection is either public (listed on the home page for everyone via `GET /api/public/collections`) or private (invisible to everyone but the admin). There is no "only people with the link" middle ground.

## Goals

- Admin can generate a share link for a **private** collection from the admin dashboard.
- Anyone opening the link can browse that collection's playlists and stream its tracks — nothing else.
- Links are unguessable, do not expire, and are manually revocable/regenerable.
- The existing public API and public site behavior stay byte-for-byte unchanged.
- Schema leaves room for a future Samply-style "members" tier (per-person links/roles) without rework.

## Non-Goals

- No recipient accounts, logins, passwords, or email invitations (future members tier).
- No link expiry dates.
- No share links for individual playlists or tracks.
- No Firebase-mode implementation.

## Data Model

New migration `server/src/migrations/003_collection_shares.sql`:

```sql
CREATE TABLE IF NOT EXISTS collection_shares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE,      -- 32 bytes crypto-random, base64url (~43 chars)
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz                 -- null = active
);

CREATE INDEX IF NOT EXISTS collection_shares_collection_idx
  ON collection_shares (collection_id);
```

Tokens are generated server-side with `crypto.randomBytes(32).toString('base64url')`.

**Members-tier future-proofing:** this table becomes the grants table later by adding columns (`label`, `invitee_email`, `role`). One row per person is exactly the members-lite shape; nothing here needs to change.

## Backend — Share Routes

New file `server/src/routes/share.js`, mounted at `/api/public/share` (unauthenticated). The token always travels in the **URL path**, never a query string.

A shared helper resolves a token to its collection:

```sql
SELECT c.* FROM collection_shares s
JOIN collections c ON c.id = s.collection_id
WHERE s.token = $1 AND s.revoked_at IS NULL
```

Unknown, revoked, and never-existed tokens are indistinguishable: all yield `404 { error: 'Share not found' }`.

### Endpoints

| Route | Behavior |
|---|---|
| `GET /api/public/share/:token` | Collection metadata + its playlists (with track counts/durations, excluding `is_excluded` tracks) in a single response: `{ collection, playlists }`. |
| `GET /api/public/share/:token/playlists/:playlistId/tracks` | Tracks of that playlist, 404 unless the playlist belongs to the shared collection. Same shape as `GET /api/public/playlists/:id/tracks`. |
| `POST /api/public/share/:token/stream` | Same contract as `POST /api/public/stream` (`{ filePath }` → `{ streamUrl }`), but the allow-list is "track belongs to the shared collection and is not excluded" instead of the public-playlist rule. |
| `POST /api/public/share/:token/streams` | Batch variant mirroring `POST /api/public/streams` (max 25 paths; non-allowed paths resolve to `null`). |

Notes:

- Playlist visibility inside a share ignores `is_public` — the share grants the whole collection. Excluded tracks (`is_excluded`) stay hidden exactly as on the public site.
- The existing `VISIBLE_PLAYLIST` logic and all current `/api/public/*` routes are untouched.
- Duration reporting (`POST /api/public/tracks/:id/duration`) remains public-playlist-only; the share view does not report durations.
- A light rate limit guards the share lookup against token brute force (e.g. per-IP limiter on `/api/public/share/*`, reusing whatever middleware pattern the server already has; if none exists, a small in-memory limiter is acceptable).

## Backend — Admin Routes

Added to `server/src/routes/admin.js` (JWT-protected, same as existing admin CRUD):

| Route | Behavior |
|---|---|
| `GET /api/admin/collections/:id/shares` | List share links for a collection: `[{ id, token, createdAt, revokedAt }]`. |
| `POST /api/admin/collections/:id/shares` | Create a link; returns the new row. 404 if the collection doesn't exist. |
| `DELETE /api/admin/shares/:id` | Revoke: `SET revoked_at = now()` (idempotent; keeps the row for audit). |

"Regenerate" in the UI is revoke + create — no dedicated endpoint.

## Frontend

### Share view (`/share/:token`)

- New route in `src/AppRouter.tsx`: `/share/:token` → the public app rendering a share-scoped collection view.
- New `src/services/shareDataService.ts` mirroring `publicDataService.ts` (including its client-side caches) but hitting the share endpoints. It carries the token from the URL.
- The existing collection/playlist view components and the global audio player are reused. While browsing a shared collection, the player's stream-URL and prefetch calls go through `shareDataService` (token-scoped endpoints); duration reporting is a no-op in share context.
- The share view renders only that collection: no navigation chrome leading to the home catalog. (Visiting `/` still shows only public collections, so nothing leaks regardless.)
- Unknown/revoked token → friendly "This link is no longer available" page.

### Admin dashboard (`src/admin/ServerAdminDashboard.tsx` area)

- Each collection row gets a **Share** action opening a dialog:
  - Lists existing links with created date and active/revoked state.
  - **Create link** button; new links show the full URL `https://<current host>/share/<token>` with copy-to-clipboard.
  - **Revoke** per link; **Regenerate** = revoke old + create new.
- Client calls go through `src/services/adminApiService.ts` (new methods: `listCollectionShares`, `createCollectionShare`, `revokeShare`).

## Error Handling

- All share endpoints: 404 with a generic body for bad tokens; stream endpoints never reveal whether a Dropbox path exists.
- Frontend surfaces network/404 errors as the "link no longer available" page rather than a spinner or crash.
- Admin dialog surfaces API errors with the dashboard's existing toast/error pattern.

## Security Considerations

- Token entropy: 256 bits, unguessable; uniqueness enforced by the DB constraint.
- Token never appears in query strings (avoids server-log leakage); path segments do appear in access logs — acceptable for this threat model, same as Samply-style public links.
- Revocation is immediate: every request re-checks `revoked_at IS NULL` (no server-side session caching of share validity). Client-side stream-URL caches may let an already-loaded page keep playing already-resolved tracks for up to ~3h after revocation; new lookups fail immediately. Accepted.
- Share stream endpoints reuse the existing `streamLinks` cache; audio still streams directly from Dropbox, never proxied.

## Testing / Verification

The repo has no automated test suite; `npm run test:ci` is a placeholder. Verification:

1. `npm run typecheck` and `npm run lint` pass (frontend); `cd server && npm run lint` if a lint script exists.
2. Manual pass against the container stack:
   - Create a private collection with a synced playlist; confirm it is absent from `/api/public/collections` and the home page.
   - Create a share link in the admin dashboard; open it in an incognito window; browse playlists and play tracks.
   - Confirm the share view exposes no path to other collections.
   - Revoke the link; reload → "link no longer available"; stream endpoint returns 404 for new lookups.
   - Regenerate; new link works, old link stays dead.

## References

- Samply sharing model (public links vs. members): https://docs.samply.app/sharing.html, https://docs.samply.app/projects.html
