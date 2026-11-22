// `pnpm tunnel`: puts the local stack on the internet through Cloudflare quick tunnels, so phones and
// computers on any network can use it while it runs here. No Cloudflare account needed.
//
// 1. Brings up Docker and local Supabase (same as `pnpm db:up`).
// 2. Opens one tunnel per service: Supabase, API, player app, venue dashboard, landing page.
//    Each gets a random https://<words>.trycloudflare.com address that changes on every run.
// 3. Starts the four apps pointed at those addresses. The addresses are passed as environment
//    variables, which override .env / .env.local, so those files are never edited.
// 4. Prints the links to share. Ctrl+C stops the tunnels and the apps (Supabase keeps running).
//
// Anyone with the links reaches your LOCAL database, which uses well-known default keys. Share them
// only with people you trust, and stop the tunnels when you're done.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { connect } from 'node:net';

const win = process.platform === 'win32';
const root = new URL('..', import.meta.url);

const SERVICES = {
  supabase: { port: 55421, label: 'Supabase' },
  api: { port: 8787, label: 'API' },
  player: { port: 8081, label: 'Player app' },
  venue: { port: 5173, label: 'Venue dashboard' },
  site: { port: 5174, label: 'Landing page' },
};
const APPS = ['api', 'player', 'venue', 'site'];

const children = [];
let stopping = false;

function fail(message) {
  console.error(`\n${message}`);
  stop(1);
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (win) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
    }
  }
  process.exit(code);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

/** True when something accepts connections on localhost:port (IPv4 or IPv6). */
function listening(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: 'localhost', port, autoSelectFamily: true });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1500);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
  });
}

function start(name, cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    shell: win && cmd !== 'cloudflared',
    detached: !win,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  child.on('error', (err) => fail(`Could not start ${name}: ${err.message}`));
  // Ctrl+C reaches the children too; wait a moment so that reads as a normal stop, not a crash.
  child.on('exit', (code) =>
    setTimeout(() => {
      if (!stopping) fail(`${name} stopped (exit code ${code}). Stopping everything.`);
    }, 500),
  );
  return child;
}

// Terminal codes other than colours (cursor moves, line clears). Expo's progress output uses them to
// redraw its own lines; passed through, they erase other apps' lines and the summary.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching the escape character is the point
const CURSOR_CODES = /\x1b\[[0-9;?]*[A-La-ln-z]/g;

/** Prefixes each output line with the app's name. */
function prefixOutput(child, name) {
  const tag = `[${name}]`.padEnd(9);
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const raw of lines) {
        // A bare \r redraws the line in place; keep only the last version.
        const line = raw.replace(CURSOR_CODES, '').split('\r').pop();
        if (line.trim()) console.log(`${tag} ${line}`);
      }
    });
  }
}

/** Stops one child process (and its own children on Windows). */
function kill(child) {
  if (child.exitCode !== null || !child.pid) return;
  if (win) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
}

// A quick tunnel's address. Not api.trycloudflare.com: that's Cloudflare's own service, and it
// appears in cloudflared's error when handing out an address fails.
const TUNNEL_URL = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/;

/** One attempt at a quick tunnel: resolves with its address, or with why there isn't one. */
function tryTunnel(port) {
  return new Promise((resolve) => {
    const child = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], {
      cwd: root,
      detached: !win,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    const tunnel = { child, log: '' };
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ...tunnel, ...result });
    };
    const timer = setTimeout(() => {
      kill(child);
      finish({ reason: 'no address after 60s' });
    }, 60_000);
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        tunnel.log = (tunnel.log + chunk).slice(-20_000);
        const match = tunnel.log.match(TUNNEL_URL);
        if (match) finish({ url: match[0] });
      });
    }
    child.on('error', (err) => finish({ reason: err.message }));
    child.on('exit', (code) => {
      const why = tunnel.log.match(/failed to request quick Tunnel: ([^\n]+)/)?.[1]?.trim();
      finish({ reason: why ?? `cloudflared exited (code ${code})` });
    });
  });
}

/**
 * Opens a quick tunnel to localhost:port and resolves with its public https address. Cloudflare's
 * free quick-tunnel service sometimes times out handing out an address, so a failed attempt is
 * retried a few times. Once open, a tunnel that stops takes everything down, with its last log lines.
 */
async function openTunnel(key) {
  const { port, label } = SERVICES[key];
  const tries = 4;
  for (let attempt = 1; ; attempt++) {
    const tunnel = await tryTunnel(port);
    if (tunnel.url) {
      tunnel.child.on('exit', (code) =>
        setTimeout(() => {
          if (stopping) return;
          const tail = tunnel.log.trim().split(/\r?\n/).slice(-6).join('\n');
          fail(`${label} tunnel stopped (exit code ${code}). Stopping everything.\nLast cloudflared lines:\n${tail}`);
        }, 500),
      );
      console.log(`  ${label.padEnd(16)} ${tunnel.url}`);
      return tunnel.url;
    }
    if (attempt >= tries) throw new Error(`Could not open the ${label} tunnel after ${tries} tries: ${tunnel.reason}`);
    console.log(`  ${label.padEnd(16)} Cloudflare didn't hand out an address (${tunnel.reason}). Trying again…`);
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
}

/** Waits until the public address answers (DNS for new quick tunnels takes a few seconds). */
async function reachable(url, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !stopping) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      // 502/530: Cloudflare is up but the app isn't answering yet.
      if (res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

/** CORS_ORIGINS from apps/api/.env, so the tunnel origins are added to it rather than replacing it. */
function apiCorsOrigins() {
  try {
    const env = readFileSync(new URL('apps/api/.env', root), 'utf8');
    return (
      env
        .match(/^CORS_ORIGINS=(.*)$/m)?.[1]
        .trim()
        .replace(/^["']|["']$/g, '') ?? ''
    );
  } catch {
    return '';
  }
}

// 1. Docker and local Supabase.
if (spawnSync('cloudflared', ['--version'], { stdio: 'ignore' }).status !== 0) {
  fail('cloudflared is not installed. Install it (winget install Cloudflare.cloudflared), then run this again.');
}
const dbUp = spawnSync(process.execPath, ['scripts/db-up.mjs'], { cwd: root, stdio: 'inherit' });
if (dbUp.status !== 0) fail('Local Supabase did not start.');

// The apps must be started by this script, with the tunnel addresses; copies already running
// would keep pointing at localhost and hold the ports.
const busy = [];
for (const key of APPS) if (await listening(SERVICES[key].port)) busy.push(`${SERVICES[key].label} (${SERVICES[key].port})`);
if (busy.length) {
  fail(
    `Already running: ${busy.join(', ')}.\nStop the apps first (VS Code: Tasks: Terminate Task > All Running Tasks), ` +
      'then run pnpm tunnel again. Supabase can stay up.',
  );
}

// 2. Tunnels.
console.log('\nOpening Cloudflare tunnels…');
const keys = Object.keys(SERVICES);
const urls = {};
// One at a time: the free quick-tunnel service times out more often on several requests at once.
for (const key of keys) {
  try {
    urls[key] = await openTunnel(key);
  } catch (err) {
    fail(err.message);
  }
}

// 3. Apps, pointed at the tunnels.
console.log('Starting the apps…\n');
const cors = [apiCorsOrigins(), urls.player, urls.venue].filter(Boolean).join(',');
const apps = {
  api: start('API', 'pnpm', ['--filter', '@verzus/api', 'dev'], { CORS_ORIGINS: cors }),
  player: start('Player app', 'pnpm', ['--filter', '@verzus/player', 'web'], {
    EXPO_PUBLIC_SUPABASE_URL: urls.supabase,
    EXPO_PUBLIC_API_URL: urls.api,
    BROWSER: 'none',
  }),
  venue: start('Venue dashboard', 'pnpm', ['--filter', '@verzus/venue', 'dev'], {
    VITE_SUPABASE_URL: urls.supabase,
    VITE_API_URL: urls.api,
  }),
  site: start('Landing page', 'pnpm', ['--filter', '@verzus/site', 'dev'], {
    VITE_PLAYER_URL: urls.player,
    VITE_VENUE_URL: urls.venue,
  }),
};
for (const [name, child] of Object.entries(apps)) prefixOutput(child, name);

// 4. Links, once they answer.
const ok = await Promise.all(keys.map((key) => reachable(urls[key])));
const line = (key) => `  ${SERVICES[key].label.padEnd(16)} ${urls[key]}${ok[keys.indexOf(key)] ? '' : '   (not answering yet)'}`;
console.log(`
──────────────────────────────────────────────────────────────────────
 verzus is online. Share these links (they change on every run):

${line('player')}   sign in: /dev-login
${line('venue')}   sign in: /dev-login
${line('site')}

 Used by the apps behind the scenes:
${line('api')}
${line('supabase')}

 Anyone with these links can reach your local database.
 Press Ctrl+C to stop the tunnels and apps (Supabase keeps running).
──────────────────────────────────────────────────────────────────────
`);
