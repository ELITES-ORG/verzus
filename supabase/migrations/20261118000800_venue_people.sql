-- Who works at a venue, with their sign-in email. Emails live in auth.users, which apps can't
-- read, so this returns them only to the venue's owners and to verzus admins. Everyone else,
-- staff included, gets no rows.

create function public.venue_people(p_venue_id uuid)
returns table (user_id uuid, role public.venue_role, display_name text, email text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.role, p.display_name, u.email::text, m.created_at
  from public.venue_members m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.venue_id = p_venue_id
    and (public.is_venue_member(p_venue_id, true) or public.is_admin())
  order by m.role, m.created_at;
$$;

revoke execute on function public.venue_people(uuid) from public, anon;
grant execute on function public.venue_people(uuid) to authenticated;
