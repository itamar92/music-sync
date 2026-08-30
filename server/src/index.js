// MusicSync container-mode backend: Express + Postgres + server-side Dropbox.
// nginx proxies /api/* here with the path intact, so routes mount under /api.
import express from 'express';
import { migrate, pool, query, waitForDatabase } from './db.js';
import { isConfigured, startKeepalive, tokenStatus } from './dropbox.js';
import { scheduleDurationBackfill } from './durationBackfill.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import shareRoutes from './routes/share.js';
import { pruneExpired } from './streamLinks.js';

const PORT = Number(process.env.PORT) || 8080;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
app.disable('x-powered-by');
// Behind nginx and the Cloudflare tunnel.
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

// Same-origin in production (nginx serves both); this only opens the door for a
// local `npm run dev` frontend when ALLOWED_ORIGINS is set explicitly.
if (ALLOWED_ORIGINS.length > 0) {
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      // PUT is in here for the track-order routes. Production is same-origin
      // through nginx and never preflights, so leaving it out went unnoticed —
      // it only ever broke reordering against a local `npm run dev` frontend.
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

app.get('/healthz', (_req, res) => res.type('text').send('ok'));

app.get('/api/status', async (_req, res) => {
  const dropbox = await tokenStatus();
  let database = false;
  try {
    await query('SELECT 1');
    database = true;
  } catch (err) {
    console.error('[status] database check failed:', err.message);
  }

  res.status(database && dropbox.hasToken ? 200 : 503).json({
    ok: database && dropbox.hasToken,
    database,
    hasToken: dropbox.hasToken,
    dropbox,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// Share links mount ahead of the public router so a token can never be read as
// a public collection id, and so the share rate limiter only sees share traffic.
app.use('/api/public/share', shareRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature.
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  // Errors raised with a message written for the person who pressed the button
  // say so explicitly, and are the only ones passed through verbatim.
  if (err.expose) {
    return res.status(err.status || 502).json({ error: err.message });
  }
  if (err.dropbox) {
    // Detail is actionable for the admin (bad/expired refresh token, rate limit)
    // but must not leak upstream internals to the public site.
    const isAdmin = req.path.startsWith('/api/admin');
    return res.status(502).json({
      error: isAdmin ? err.message : 'Track temporarily unavailable',
    });
  }
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await waitForDatabase();
  await migrate();

  if (!isConfigured()) {
    console.warn(
      '[startup] Dropbox refresh token missing — the site will load but cannot stream. ' +
      'Set DROPBOX_REFRESH_TOKEN (see SETUP_REFRESH_TOKEN.md).',
    );
  }
  startKeepalive();

  const prune = setInterval(() => { pruneExpired(); }, PRUNE_INTERVAL_MS);
  prune.unref?.();

  // Catches every track that has been sitting at 0:00 — the whole library on
  // the first boot after migration 007, then only whatever the last sync added
  // and the process died before measuring. Deliberately not awaited: the site
  // serves fine while durations are still filling in.
  scheduleDurationBackfill('startup');

  const server = app.listen(PORT, () => console.log(`[startup] listening on :${PORT}`));

  const shutdown = (signal) => {
    console.log(`[shutdown] ${signal}`);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[startup] failed:', err);
  process.exit(1);
});
