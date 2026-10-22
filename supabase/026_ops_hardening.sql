-- 026_ops_hardening.sql
-- Collision-free referral ids, contact-form throttling, and a server-only
-- contact insert path.

create sequence if not exists public.profile_unique_id_seq;
select setval(
  'public.profile_unique_id_seq',
  greatest(coalesce((select max(unique_id) from public.profiles), 10000), 10000),
  true
);

create or replace function public.next_unique_id()
returns integer
language sql
security definer
set search_path = public
as $$
  select nextval('public.profile_unique_id_seq')::integer;
$$;

revoke all on function public.next_unique_id() from public;
revoke all on function public.next_unique_id() from anon, authenticated;
grant execute on function public.next_unique_id() to service_role;

create table if not exists public.contact_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_contact_attempts_ip_time
  on public.contact_attempts (ip, created_at);
alter table public.contact_attempts enable row level security;
revoke all on public.contact_attempts from anon, authenticated;

-- Contact messages now go through /api/contact, which validates and throttles
-- them with the service role.
revoke insert on public.contact from anon, authenticated;
