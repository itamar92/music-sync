#!/usr/bin/env node
/**
 * One-shot Dropbox refresh-token provisioning for container mode.
 *
 * Does everything except the browser login: prints the authorize URL, takes the
 * code you paste back, exchanges it, then writes DROPBOX_REFRESH_TOKEN into the
 * repo .env AND the deploy checkout's .env (the file the running stack reads),
 * updates the GitHub secret, restarts the backend, and checks /api/status.
 *
 * The token is never printed or logged.
 *
 *   node scripts/setup-dropbox-token.js
 *   node scripts/setup-dropbox-token.js --no-restart   # write files only
 *
 * Unlike the older generate-refresh-token.js, this reads the app credentials
 * from .env instead of hardcoding them, and needs no npm dependencies.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline/promises');
const { spawnSync } = require('node:child_process');

const REDIRECT_URI = 'http://localhost:3000';
const TOKEN_KEY = 'DROPBOX_REFRESH_TOKEN';
const PUBLIC_URL = 'https://music-sync.im-tools.org';

const repoRoot = path.resolve(__dirname, '..');
const repoEnv = path.join(repoRoot, '.env');
const deployDir = process.env.DEPLOY_DIR || path.join(os.homedir(), 'deploys', 'music-sync');
const deployEnv = path.join(deployDir, '.env');
const composeFile = path.join(deployDir, 'docker-compose.deploy.yml');

const skipRestart = process.argv.includes('--no-restart');

function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

/** Set (or replace) one key in an .env file, preserving everything else. */
function writeEnvValue(file, key, value) {
  const line = `${key}=${value}`;
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${line}\n`);
    return 'created';
  }
  const text = fs.readFileSync(file, 'utf8');
  const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (pattern.test(text)) {
    fs.writeFileSync(file, text.replace(pattern, line));
    return 'updated';
  }
  const separator = text.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(file, `${text}${separator}${line}\n`);
  return 'appended';
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', shell: false, ...options });
}

async function main() {
  const env = parseEnv(repoEnv);
  const appKey = process.env.DROPBOX_APP_KEY || env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET || env.DROPBOX_APP_SECRET;

  if (!appKey || !appSecret) {
    console.error(`❌ DROPBOX_APP_KEY / DROPBOX_APP_SECRET not found in ${repoEnv}`);
    console.error('   Fill them in (see .env.docker.example) and re-run.');
    process.exit(1);
  }

  const authUrl =
    'https://www.dropbox.com/oauth2/authorize' +
    `?client_id=${encodeURIComponent(appKey)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    '&response_type=code' +
    '&token_access_type=offline';

  console.log('\n🔐 Dropbox refresh token setup\n');
  console.log('1. Open this URL and approve access:\n');
  console.log(`   ${authUrl}\n`);
  console.log(`2. You land on ${REDIRECT_URI}/?code=... — the page will not load. That is fine.`);
  console.log('3. Copy the value of the "code" query parameter and paste it below.\n');
  console.log(`   (${REDIRECT_URI} must be a registered redirect URI, and the app's`);
  console.log('    "Access token expiration" must allow offline access, or no refresh');
  console.log('    token comes back.)\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question('Authorization code: ')).trim();
  rl.close();

  if (!code) {
    console.error('❌ No code entered.');
    process.exit(1);
  }

  console.log('\n⏳ Exchanging code for a refresh token...');
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    console.error(`❌ Exchange failed (${response.status}): ${data.error_description || data.error || 'unknown error'}`);
    console.error('   Authorization codes are single-use and expire quickly — get a fresh one and retry.');
    process.exit(1);
  }

  const refreshToken = data.refresh_token;
  if (!refreshToken) {
    console.error('❌ Dropbox returned an access token but no refresh token.');
    console.error('   The app is not configured for offline access — fix that in the');
    console.error('   Dropbox App Console, then re-run.');
    process.exit(1);
  }
  console.log('✅ Refresh token received (not printed).');

  // 1. repo .env — local dev + the copy provisioning stages from
  console.log(`\n📝 ${repoEnv}: ${writeEnvValue(repoEnv, TOKEN_KEY, refreshToken)}`);

  // 2. deploy checkout .env — THIS is what the running stack reads
  if (fs.existsSync(deployDir)) {
    console.log(`📝 ${deployEnv}: ${writeEnvValue(deployEnv, TOKEN_KEY, refreshToken)}`);
  } else {
    console.warn(`⚠️  ${deployDir} not found — the running stack was NOT updated.`);
  }

  // 3. GitHub secret — record only; CI never writes .env on the host
  const gh = run('gh', ['secret', 'set', TOKEN_KEY, '--body', refreshToken], { cwd: repoRoot });
  console.log(gh.status === 0
    ? `🔑 GitHub secret ${TOKEN_KEY}: set`
    : `⚠️  Could not set the GitHub secret (${(gh.stderr || '').trim() || 'gh failed'})`);

  if (skipRestart) {
    console.log('\n--no-restart given; restart the backend yourself to pick this up.');
    return;
  }

  if (!fs.existsSync(composeFile)) {
    console.warn(`\n⚠️  ${composeFile} not found — skipping restart.`);
    return;
  }

  console.log('\n🔄 Restarting the backend container...');
  const up = run('docker', ['compose', '-f', composeFile, 'up', '-d', 'backend'], { cwd: deployDir });
  if (up.status !== 0) {
    console.error(`❌ Restart failed: ${(up.stderr || up.stdout || '').trim()}`);
    process.exit(1);
  }

  console.log('🔍 Checking /api/status...');
  for (let attempt = 1; attempt <= 10; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const status = await (await fetch(`${PUBLIC_URL}/api/status`)).json();
      if (status.hasToken) {
        console.log(`\n✅ hasToken: true — Dropbox is live at ${PUBLIC_URL}`);
        console.log('   Next: open /admin, sync a Dropbox folder, publish it.');
        return;
      }
      console.log(`   attempt ${attempt}/10: hasToken false (${status.dropbox?.error || 'starting up'})`);
    } catch {
      console.log(`   attempt ${attempt}/10: status endpoint not answering yet`);
    }
  }
  console.error('\n❌ Still no token after ~30s. Check: docker logs music-sync-backend');
  process.exit(1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  });
}

module.exports = { parseEnv, writeEnvValue };
