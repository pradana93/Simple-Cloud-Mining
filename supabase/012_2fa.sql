-- 012_2fa.sql
-- Opt-in TOTP two-factor auth. Secrets and pending login sessions are never
-- exposed to the browser, so both tables are service-role only: RLS is on and
-- every client grant is revoked. The app reaches them through the admin client.

create table if not exists public.user_2fa (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  secret text not null,
  enabled boolean not null default false,
  confirmed_at timestamptz,
  last_step bigint,
  recovery jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_2fa enable row level security;
revoke all on public.user_2fa from anon, authenticated;

-- A password check that still owes a TOTP code parks its Supabase session here
-- until the code clears, so a stolen password alone never yields a session.
create table if not exists public.login_pending_2fa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  exp timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.login_pending_2fa enable row level security;
revoke all on public.login_pending_2fa from anon, authenticated;
create index if not exists idx_pending_2fa_exp on public.login_pending_2fa(exp);
