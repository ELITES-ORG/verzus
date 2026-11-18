# verzus

Book a court near you and turn the booking into a ranked or casual match.
One TypeScript monorepo: a player app (PWA first, iOS and Android later), a venue
dashboard, a trusted API, and Supabase.

```
apps/
  player/        Expo + Expo Router + NativeWind. Web export is the PWA.
  venue/         Vite + React + Tailwind + FullCalendar. Staff calendar and /admin.
  api/           Node + Hono on Render. Money, ratings, match state. Cron jobs.
  site/          Public landing page. Vite, no framework, Sakuga VFX controls (vendored).
packages/
  schemas/       zod input schemas shared by apps and API (+ zod-free /constants)
  rating/        OpenSkill rules: tiers, placement, inactivity, seasons (+ /tiers for UI)
  matchmaking/   fair-game suggestions that widen over time
  db-types/      types generated from the database
  tailwind/      brand colors shared by both apps
supabase/
  migrations/    schema, RLS, functions (source of truth for the database)
  tests/         pgTAP tests for the guarantees below
  seed.sql       local sample venues
```

## How it fits together

- Apps **read** from Supabase directly. Row-level security decides what each user sees.
- Anything touching **money, ratings or match state** goes through the API, which verifies the
  user's Supabase token and writes in one Postgres transaction. Apps have no write access to
  those tables.
- The database itself enforces the critical rules:
  - no double bookings (an exclusion constraint covering app, walk-in, phone and blocked slots)
  - unpaid holds expire every minute (pg_cron)
  - every ledger transaction must balance; ledger and rating history are append-only
- Rating and matchmaking logic are pure functions in `packages/`, unit-tested without a database.

## Getting started

Needs Node 24+, pnpm 12, Docker (for local Supabase) and the Supabase CLI.

```sh
pnpm install
pnpm db:start          # local Supabase on ports 554xx (doesn't clash with other projects on 543xx)
supabase status        # shows the local API URL and publishable key
```

Copy each `.env.example` to the file it names and fill in the values from `supabase status`:

| App    | File                              | Start                                          |
| ------ | --------------------------------- | ---------------------------------------------- |
| API    | `apps/api/.env`                   | `pnpm --filter @verzus/api dev` (port 8787)    |
| Player | `apps/player/.env.local`          | `pnpm --filter @verzus/player web` (port 8081) |
| Venue  | `apps/venue/.env.local`           | `pnpm --filter @verzus/venue dev` (port 5173)  |
| Site   | `apps/site/.env.local` (optional) | `pnpm --filter @verzus/site dev` (port 5174)   |

Leave `SUPABASE_JWT_SECRET` empty: the API checks sign-in tokens against Supabase's public keys.

### Dev login (local only)

Skip email codes while developing: open **http://localhost:5173/dev-login** (venue portal) or
**http://localhost:8081/dev-login** (player app) and pick an account. The seeded accounts all use the
password `verzus-dev`:

| Account                | Role                    | What it has                                                                                                                         |
| ---------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `admin@verzus.local`   | verzus admin            | Review queue (Kapitolyo Courts is waiting), owner invites                                                                           |
| `owner@verzus.local`   | New venue owner         | Nothing yet: the first dev login goes through onboarding (invite, name the venue, setup wizard); later logins return to their venue |
| `venues@verzus.local`  | Established venue owner | Makati Hoops Center and BGC Smash Hall (live), Kapitolyo Courts (in review)                                                         |
| `staff@verzus.local`   | Venue staff             | Calendar at BGC Smash Hall                                                                                                          |
| `player1@verzus.local` | Player                  | Badminton, Silver II                                                                                                                |
| `player2@verzus.local` | Player                  | Badminton, Silver I                                                                                                                 |

To go through owner onboarding again, run `pnpm db:reset` (this wipes local data and reseeds).

They come from `supabase/seed.sql`. A fresh database gets them automatically; to add them to an
existing local database without wiping it, run `pnpm db:seed` (safe to repeat). The seed never
reaches the hosted project (`supabase db push` doesn't run it), the dev-login pages are left out of
production builds, and they refuse to run against a non-local Supabase.

Local phone login (player app): use `+639170000001` or `+639170000002` with code `123456`
(see `[auth.sms.test_otp]` in `supabase/config.toml`; no SMS is sent).

Venue portal sign-in is by email: the code and link arrive in Mailpit at http://127.0.0.1:55424.
Venues are invite-only. To make a local invite:

```sh
docker exec supabase_db_verzus psql -U postgres -tAc "insert into venue_invites (note) values ('me') returning token"
```

then open `http://localhost:5173/join/<token>`.

**Making yourself a verzus admin** (review queue, owner invites, approving venues): sign in to the
venue portal once, then run

```sh
docker exec supabase_db_verzus psql -U postgres -c "update auth.users set raw_app_meta_data = raw_app_meta_data || '{\"verzus_admin\": true}' where email = 'you@example.com'"
```

and sign out and in again. On the hosted project, run the same `update` in the Supabase SQL editor.
After that, invite owners from **Admin → Owner invites** instead of SQL.

**All at once in VS Code or Cursor:** Command Palette → **Tasks: Run Task** → **verzus: start all**.
It starts Docker Desktop if needed, brings up Supabase (`pnpm db:up`, a no-op when it's already
running), then opens one terminal each for the API, player app, venue dashboard and landing page.

Stop the apps with **Tasks: Terminate Task** → **All Running Tasks**, and the database with
`pnpm db:stop` (or the **verzus: stop database** task).

## Everyday commands

```sh
pnpm lint              # Biome (lint + format check); pnpm format to fix
pnpm typecheck         # all workspaces
pnpm test              # unit tests
supabase test db       # database tests (needs pnpm db:start)
pnpm db:reset          # rebuild local DB from migrations + seed
pnpm db:types          # regenerate packages/db-types after a migration
```

API integration test against the local database:

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55422/postgres pnpm --filter @verzus/api test
```

New migration: `supabase migration new <name>`, write SQL, `pnpm db:reset`, `pnpm db:types`,
add a pgTAP test if it adds a rule.

## Deploying

`render.yaml` is a Render Blueprint for the API (paid, always on), the player PWA, venue
dashboard and landing page (static sites) and the daily cron job. Supabase is created separately, in the same
region. Secrets go in the Render and Supabase dashboards, never in the repo.

The API **refuses to start in production** with `PAYMENT_PROVIDER=fake`. A real payment
provider must be chosen and added under `apps/api/src/adapters/payments/` first.

## Still to decide before production

- Payment provider (split court fees, pay venues out). Xendit or PayMongo for the Philippines.
- SMS provider for phone login (configured in the Supabase dashboard).
- Address search (geocoding), if players need to search places. Maps themselves are decided:
  MapLibre with OpenFreeMap tiles (free, no key); `VITE_MAP_STYLE_URL` swaps the tile provider.
- Policy questions: what happens when nobody joins an open match; whether unconfirmed results
  auto-confirm after a timeout; payout schedule; platform fee.

## Status

Built: schema with RLS, booking with payment holds, the payment webhook flow, result confirmation
with rating updates, venue calendar with manual blocks, player screens (nearby venues, open
matches, profile tiers, match lobby with live updates), CI and deploy config.

Not built yet: opening a match, join-and-pay with cost splitting, dispute resolution, attendance
and no-show handling, push notifications, maps, season start job, onboarding self-assessment.
