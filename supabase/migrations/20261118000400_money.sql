-- Money: provider payments, a double-entry ledger, payouts, and webhook dedup.
-- Written only by the API.

create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.ledger_account as enum ('player', 'venue', 'platform', 'provider_clearing');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_ref text,
  user_id uuid not null references public.profiles (id),
  purpose text not null check (purpose in ('booking', 'match_share')),
  booking_id uuid references public.bookings (id),
  match_id uuid references public.matches (id),
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

create index payments_user_idx on public.payments (user_id, created_at desc);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Every money movement is a transaction (txn_id) of two or more entries whose
-- amounts sum to zero. Negative legs are where money comes from, positive legs
-- who now holds it. provider_clearing = money received from outside; a player's
-- balance is in-app credit; a venue's balance is owed to the venue.
--   Booking paid by card:            provider_clearing −300, venue(court) +300
--   Joiner's 150 share to booker:    provider_clearing −150, player(booker) +150
create table public.ledger_entries (
  id bigint generated always as identity primary key,
  txn_id uuid not null,
  account public.ledger_account not null,
  -- The player or venue for those accounts; null for platform and provider_clearing.
  account_id uuid,
  amount_cents bigint not null check (amount_cents <> 0),
  currency char(3) not null,
  -- e.g. 'court_fee', 'share_charge', 'share_credit', 'refund', 'no_show_forfeit', 'payout'
  kind text not null,
  payment_id uuid references public.payments (id),
  booking_id uuid references public.bookings (id),
  match_id uuid references public.matches (id),
  created_at timestamptz not null default now(),
  check ((account in ('player', 'venue')) = (account_id is not null))
);

create index ledger_txn_idx on public.ledger_entries (txn_id);
create index ledger_account_idx on public.ledger_entries (account, account_id, created_at desc);

create trigger ledger_append_only before update or delete on public.ledger_entries
  for each row execute function public.forbid_change();

-- Checked at commit, so a transaction may insert its entries one by one.
create function public.check_ledger_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  total bigint;
  currencies int;
begin
  select sum(amount_cents), count(distinct currency) into total, currencies
  from public.ledger_entries where txn_id = new.txn_id;
  if total <> 0 then
    raise exception 'ledger transaction % does not balance (sum %)', new.txn_id, total;
  end if;
  if currencies <> 1 then
    raise exception 'ledger transaction % mixes currencies', new.txn_id;
  end if;
  return null;
end;
$$;

create constraint trigger ledger_balanced
  after insert on public.ledger_entries
  deferrable initially deferred
  for each row execute function public.check_ledger_balanced();

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id),
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider_ref text,
  created_at timestamptz not null default now()
);

-- Providers resend webhooks; the API records each event id and skips repeats.
create table public.webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  primary key (provider, event_id)
);

alter table public.payments enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payouts enable row level security;
alter table public.webhook_events enable row level security;

create policy "players see their payments"
  on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "players see their ledger; owners see their venue's"
  on public.ledger_entries for select to authenticated
  using (
    (account = 'player' and account_id = (select auth.uid()))
    or (account = 'venue' and public.is_venue_member(account_id, true))
    or public.is_admin()
  );

create policy "owners see their payouts"
  on public.payouts for select to authenticated
  using (public.is_venue_member(venue_id, true) or public.is_admin());

-- webhook_events: no policies, so no app access at all.
