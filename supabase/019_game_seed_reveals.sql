-- 019_game_seed_reveals.sql
-- Keep every revealed server seed so a settled round stays verifiable after
-- more than one rotation. Only seeds that have already been rotated are stored.

create table if not exists public.game_seed_reveals (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  server_seed text not null,
  server_seed_hash text not null,
  rotated_at timestamptz not null default now(),
  unique (user_id, server_seed_hash)
);

create index if not exists idx_game_seed_reveals_user
  on public.game_seed_reveals(user_id, rotated_at desc);

alter table public.game_seed_reveals enable row level security;

drop policy if exists "read own seed reveals" on public.game_seed_reveals;
create policy "read own seed reveals" on public.game_seed_reveals
  for select using (auth.uid() = user_id);

grant select on public.game_seed_reveals to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.game_seed_reveals from anon, authenticated;

insert into public.game_seed_reveals (user_id, server_seed, server_seed_hash, rotated_at)
select user_id, prev_server_seed, prev_server_seed_hash, coalesce(rotated_at, now())
  from public.game_seeds
 where prev_server_seed is not null
   and prev_server_seed_hash is not null
on conflict (user_id, server_seed_hash) do nothing;

-- Rotation and archive happen in one transaction, so a failed rotation can
-- never expose the current seed.
create or replace function public.rotate_game_seed(
  p_user uuid,
  p_next_seed text,
  p_next_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.game_seeds%rowtype;
begin
  if p_next_seed is null or length(p_next_seed) = 0 then
    raise exception 'next server seed is required';
  end if;
  if p_next_hash is null or length(p_next_hash) <> 64 then
    raise exception 'next server seed hash is invalid';
  end if;

  select * into v
    from public.game_seeds
   where user_id = p_user
   for update;
  if not found then
    raise exception 'seed row missing';
  end if;

  insert into public.game_seed_reveals (user_id, server_seed, server_seed_hash, rotated_at)
  values (p_user, v.server_seed, v.server_seed_hash, now())
  on conflict (user_id, server_seed_hash) do nothing;

  update public.game_seeds
     set prev_server_seed = v.server_seed,
         prev_server_seed_hash = v.server_seed_hash,
         server_seed = p_next_seed,
         server_seed_hash = p_next_hash,
         nonce = 0,
         rotated_at = now(),
         updated_at = now()
   where user_id = p_user;
end;
$$;

revoke all on function public.rotate_game_seed(uuid, text, text) from public;
revoke all on function public.rotate_game_seed(uuid, text, text) from anon, authenticated;
grant execute on function public.rotate_game_seed(uuid, text, text) to service_role;
