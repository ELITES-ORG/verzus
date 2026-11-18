// Re-runs supabase/seed.sql against the LOCAL database (`pnpm db:seed`). Every insert in the
// seed skips rows that already exist, so this adds missing dev data without wiping anything.
// It talks to the local Docker container only; it can't reach the hosted project.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const container = 'supabase_db_verzus';
const sql = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
const run = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], {
  input: sql,
  encoding: 'utf8',
});
if (run.status !== 0) {
  console.error(run.stderr || run.stdout || `Is local Supabase running? (${container})`);
  process.exit(run.status ?? 1);
}
console.log('Local seed applied. Dev accounts use the password verzus-dev; see supabase/seed.sql.');
