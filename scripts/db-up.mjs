// Brings up local Supabase for `pnpm db:up` and the VS Code "verzus: start all" task.
// 1. If Docker isn't running, starts Docker Desktop and waits for it.
// 2. If Supabase is already running, does nothing (plain `supabase start` fails in that case).
// 3. Otherwise runs `supabase start`.
// `--check` only reports what it would do.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const check = process.argv.includes('--check');
const win = process.platform === 'win32';
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', shell: win, ...opts });
const dockerUp = () => run('docker', ['info'], { stdio: 'ignore' }).status === 0;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Docker Desktop's app, found next to the `docker` CLI first, then in the usual install places. */
function dockerDesktop() {
  if (process.platform === 'darwin') return existsSync('/Applications/Docker.app') ? '/Applications/Docker.app' : null;
  if (!win) return null;
  const where = run('where', ['docker']).stdout?.split(/\r?\n/).find(Boolean);
  const { LOCALAPPDATA = '', ProgramFiles = 'C:\\Program Files' } = process.env;
  const candidates = [
    // <install>\resources\bin\docker.exe -> <install>\Docker Desktop.exe
    where ? join(dirname(where), '..', '..', 'Docker Desktop.exe') : null,
    join(LOCALAPPDATA, 'Programs', 'DockerDesktop', 'Docker Desktop.exe'),
    join(ProgramFiles, 'Docker', 'Docker', 'Docker Desktop.exe'),
  ];
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

if (!dockerUp()) {
  const app = dockerDesktop();
  if (!app) fail('Docker is not running and Docker Desktop was not found. Start Docker, then run this again.');
  console.log(`Docker is not running. ${check ? 'Would start' : 'Starting'} Docker Desktop (${app})…`);
  if (check) process.exit(0);
  if (win) spawn(app, [], { detached: true, stdio: 'ignore' }).unref();
  else run('open', ['-a', app]);

  const deadline = Date.now() + 180_000;
  while (!dockerUp()) {
    if (Date.now() > deadline) fail('Docker did not become ready within 3 minutes. Open Docker Desktop and check it.');
    sleep(3000);
  }
  console.log('Docker is ready.');
}

if (run('supabase', ['status', '-o', 'json'], { stdio: 'ignore' }).status === 0) {
  console.log('Local Supabase is already running.');
  process.exit(0);
}

console.log(check ? 'Would run: supabase start' : 'Starting local Supabase…');
if (check) process.exit(0);
process.exit(run('supabase', ['start'], { stdio: 'inherit' }).status ?? 1);
