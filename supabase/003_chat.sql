-- 003: support live chat between signed-in members and admins.
-- One flat message stream per user; the admin console groups it into threads.
-- Realtime (postgres_changes) delivers new rows to both sides, so the table is
-- added to the supabase_realtime publication and RLS gates who can read what.

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('user','admin')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_by_admin boolean not null default false,
  read_by_user boolean not null default false
);

create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);
create index if not exists chat_messages_unread_admin_idx
  on public.chat_messages (read_by_admin) where sender = 'user';

alter table public.chat_messages enable row level security;
-- Full replica identity so Realtime can evaluate RLS on the row it broadcasts.
alter table public.chat_messages replica identity full;

-- Admin test as a SECURITY DEFINER helper: the profiles policy only exposes the
-- caller's own row, so an inline subquery would be filtered out for admins.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

drop policy if exists "chat read own" on public.chat_messages;
create policy "chat read own" on public.chat_messages
  for select using (auth.uid() = user_id);

drop policy if exists "chat read admin" on public.chat_messages;
create policy "chat read admin" on public.chat_messages
  for select using (public.is_admin());

drop policy if exists "chat write own" on public.chat_messages;
create policy "chat write own" on public.chat_messages
  for insert with check (auth.uid() = user_id and sender = 'user');

drop policy if exists "chat mark own read" on public.chat_messages;
create policy "chat mark own read" on public.chat_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Add to Realtime once (guarded: "add table" errors if already a member).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
