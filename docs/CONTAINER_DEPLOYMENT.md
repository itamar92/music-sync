# Container Deployment (Windows / Docker, no Firebase)

This deploys MusicSync as three containers — nginx frontend, Express backend,
PostgreSQL — exposed to the internet through Cloudflare. Firebase is not used
in this mode: data lives in Postgres, admin auth is backend-issued JWT, and
all Dropbox access happens server-side.

```
Internet ──► Cloudflare (DNS/Tunnel) ──► frontend (nginx :80)
                                           ├─ static SPA (Vite build)
                                           └─ /api/* ──► backend (Express :8080)
                                                            ├─ PostgreSQL (db :5432)
                                                            └─ Dropbox API (server-side tokens)
```

## Prerequisites (Windows)

1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
   with the WSL 2 backend (Settings → General → "Use the WSL 2 based engine").
2. Git-clone this repo somewhere on the machine.
3. A Dropbox app (App key + secret) and a long-lived **refresh token** —
   provision it once following `SETUP_REFRESH_TOKEN.md`.

## First run

```powershell
cd music-sync
copy .env.docker.example .env
# edit .env — set POSTGRES_PASSWORD, Dropbox credentials, JWT_SECRET, admin login
docker compose up -d --build
```

Then check:

- `http://localhost:8090` — the site
- `http://localhost:8090/api/status` — must show `"hasToken": true, "database": true`

Migrations run automatically when the backend starts. Data persists in the
`pgdata` Docker volume across restarts and rebuilds.

### Seeding content

Log in and sync a Dropbox folder into a playlist via the admin API:

```powershell
# 1. Get a token
curl -X POST http://localhost:8090/api/admin/login -H "Content-Type: application/json" `
  -d '{"email":"you@example.com","password":"yourpass"}'

# 2. Create a collection
curl -X POST http://localhost:8090/api/admin/collections -H "Authorization: Bearer <TOKEN>" `
  -H "Content-Type: application/json" -d '{"name":"Mixdowns"}'

# 3. Sync a Dropbox folder into it (creates the playlist + tracks)
curl -X POST http://localhost:8090/api/admin/sync-folder -H "Authorization: Bearer <TOKEN>" `
  -H "Content-Type: application/json" -d '{"folderPath":"/Music/Mixes","collectionId":"<COLLECTION_ID>"}'
```

Browse Dropbox folders first with `GET /api/admin/dropbox/folders?path=/Music`.

## Exposing via Cloudflare

Two options; **Tunnel is recommended on a home/office Windows machine** because
it needs no open router ports, no static IP, and TLS is handled by Cloudflare.

### Option A — Cloudflare Tunnel (recommended)

1. In [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks →
   Tunnels → Create a tunnel (Cloudflared connector). Copy the token.
2. Put it in `.env` as `CLOUDFLARE_TUNNEL_TOKEN=...`
3. In the tunnel's Public Hostname tab, map your hostname
   (e.g. `music.yourdomain.com`) to `http://frontend:80`.
4. Start the stack with the tunnel profile:

   ```powershell
   docker compose --profile tunnel up -d
   ```

Cloudflare creates the DNS record automatically and the site is live over HTTPS.

### Option B — DNS + port forwarding

1. Forward router port 443/80 to the Windows machine's `HTTP_PORT` (8090).
2. Create an A record in Cloudflare DNS pointing at your public IP (proxied).
3. Set Cloudflare SSL mode appropriately (Flexible works without a local cert;
   Full requires terminating TLS locally — add a reverse proxy like Caddy, or
   prefer Option A instead).

## Operations

```powershell
docker compose logs -f backend      # watch token refreshes / API errors
docker compose up -d --build        # redeploy after pulling new code
docker compose exec db psql -U musicsync musicsync   # inspect the database
docker volume ls                    # pgdata holds all persistent state
```

Backup: `docker compose exec db pg_dump -U musicsync musicsync > backup.sql`

## Reliability & performance design

- **Dropbox tokens** (`server/src/dropbox.js`): one refresh token (env), the
  access token is shared via Postgres, refreshed proactively 10 minutes before
  expiry by a keepalive loop, with single-flight dedup, exponential backoff +
  jitter on 429/5xx, Retry-After honored, and automatic one-shot replay of
  requests that hit a 401. A revoked refresh token fails loudly in
  `/api/status`.
- **Streaming** (`server/src/streamLinks.js`): Dropbox temporary links (valid
  ~4h, Range-request capable) are cached memory→Postgres and handed straight
  to the `<audio>` element — audio bytes go browser↔Dropbox and are never
  proxied through the backend. `POST /api/public/streams` batch-resolves
  upcoming tracks so next-track skips start instantly; the frontend prefetches
  the next 3 tracks on every track change.
- **Frontend mode switch**: the container build sets `VITE_DATA_MODE=server`,
  which routes the public app and player through `/api` (see
  `src/services/dataMode.ts`). Builds without it keep the legacy Firebase path.
