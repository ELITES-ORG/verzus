-- Push subscriptions, Realtime, Storage buckets, and scheduled SQL jobs.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('expo', 'web')),
  -- Expo push token, or the Web Push subscription JSON (endpoint + keys).
  token text not null,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.push_subscriptions enable row level security;

create policy "users manage their own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Realtime: lobbies fill live and result confirmations appear live. Realtime
-- applies the same RLS policies, so players only receive rows they may see.
alter publication supabase_realtime add table public.matches, public.match_participants, public.result_confirmations;

-- Storage --------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('venue-photos', 'venue-photos', true)
on conflict (id) do nothing;

-- avatars/<user id>/<file>
create policy "users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- venue-photos/<venue id>/<file>
create function public.is_member_of_venue_folder(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folder text := (storage.foldername(p_name))[1];
begin
  if folder !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;
  return public.is_venue_member(folder::uuid);
end;
$$;

create policy "venue staff upload venue photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'venue-photos' and public.is_member_of_venue_folder(name));

create policy "venue staff replace venue photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'venue-photos' and public.is_member_of_venue_folder(name));

create policy "venue staff delete venue photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'venue-photos' and public.is_member_of_venue_folder(name));

-- Scheduled SQL jobs (pg_cron) -------------------------------------------------
-- Jobs that need app code (ratings, payouts, push) run as Render cron jobs.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- Releases unpaid holds so the slot or spot can be taken by someone else.
create function public.expire_holds()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bookings
     set status = 'expired'
   where status = 'held' and hold_expires_at < now();

  update public.match_participants
     set status = 'expired'
   where status = 'held' and hold_expires_at < now();
$$;

revoke execute on function public.expire_holds() from public, anon, authenticated;

select cron.schedule('expire-holds', '* * * * *', 'select public.expire_holds()');
