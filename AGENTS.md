# verzus: rules for contributors and agents

Read README.md first for layout and commands.

## Never break these

1. **Money, ratings and match state are written only by the API** (`apps/api`), inside one
   transaction. Apps never write those tables; RLS gives them no insert/update policies. Do not
   add such policies or call those writes from an app.
2. **The database enforces the hard rules.** Keep the `bookings_no_overlap` exclusion constraint,
   the `ledger_balanced` constraint trigger, and the append-only triggers on `ledger_entries` and
   `rating_history`. Change the schema only through a new migration in `supabase/migrations`;
   never edit a migration that has been deployed.
3. **Ledger signs:** negative legs are where money comes from, positive legs who now holds it.
   `provider_clearing` = money received from outside; a player's balance = in-app credit; a
   venue's balance = owed to the venue. Every transaction sums to zero in one currency.
4. **Lock order:** when locking several ratings, lock in ascending user id (`order by user_id
   for update`) to avoid deadlocks.
5. **Never hold a database transaction open across a network call** (payment provider, push).
6. **Secrets** never go in the repo or in `EXPO_PUBLIC_` / `VITE_` variables, which ship to users.
   `.env*` files are ignored; only `.env.example` is committed.

## Where code goes

- Business rules with no I/O: `packages/rating`, `packages/matchmaking` (unit-test them).
- API flows: `apps/api/src/use-cases`, depending only on interfaces in `src/ports`.
  Concrete code (SQL, providers) lives in `src/adapters`; `src/index.ts` wires them together.
- Shared input validation: `packages/schemas`. UI code that only needs enum lists imports
  `@verzus/schemas/constants`; UI that only shows tiers imports `@verzus/rating/tiers`
  (keeps zod and OpenSkill out of screen bundles).
- Database types: regenerate with `pnpm db:types`; never edit `database.types.ts` by hand.

## Player app (Expo SDK 58)

See `apps/player/AGENTS.md`. Add native-capable packages with `npx expo install` from
`apps/player`. NativeWind 4.2 needs Tailwind 3.4 and `react-native-css-interop` as a direct
dependency (pnpm isolated installs).

## Colour

Green means go (main buttons, chosen, on, done); red means danger (errors, missing fields, delete)
and nothing else; amber (`warn`) asks for a look; violet is focus and "you are here".

- Both apps are themed, light and dark. The palette's values live once, in
  `packages/tailwind/themes.js`; screens use its theme colours: `canvas`, `surface`, `surface-2`,
  `line`, `fg`, `fg-2`, `fg-3`, `accent` (with `on-accent` text), `danger`, `warn`, `violet`, and
  the corners `rounded-chip` / `rounded-control` / `rounded-panel` (4 / 5 / 6px). No new hex
  values, and not the fixed scales in `colors.js` (`ink-*`, `brand-*`) for screens.
- Venue app: the `webTheme` plugin writes the CSS variables; the choice is `data-theme` on
  <html> (`src/lib/theme.ts`, `ThemeSwitch`). Player app: `nativeTheme` plus NativeWind `vars()`
  in `src/lib/theme.tsx`, which also themes the navigator and status bar.
- Things CSS can't reach (map tiles, navigation colours) take values from `themes.js` (`rgb()`),
  or, for the map, `MAP_COLOURS` in `VenueMap.tsx`.
- The logo is green against violet (`#22c55e`; `#5a4fd8` on light, `#b8b3ff` on dark). See
  `brand/README.md`.

## Landing page (`apps/site`)

- `public/sakuga-vfx/` holds unmodified copies of Sakuga VFX (MIT). Never edit them; restyle through
  the `--sk-*` CSS variables and `window.SakugaFX.P` (see `src/main.ts`). Its README records the
  upstream commit. Load them with plain `<script defer>` tags, never as modules.
- The verzus accent is green: `--accent` `#15803d` for text and white-on-green, `--accent-bright`
  `#22c55e` for the logo and `SakugaFX.P.accent` (marks and effects, never text). The toggle
  component is not used: its painted frames have the original pink baked in.
- `src/fonts.css` loads Latin faces only; the hero's 対戦 is an inline SVG outline. Adding Japanese
  text to the page means adding glyphs the same way, not importing a whole CJK font.
- Effects follow the library's rules: nothing animates at rest, effects never carry information,
  reduced motion turns them off.

## Before calling work done

`pnpm lint`, `pnpm typecheck`, `pnpm test`; for schema changes also `supabase test db` and the
API integration test (see README).
