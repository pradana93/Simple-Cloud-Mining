-- 028_trusted_devices.sql
-- Optional "remember this device" for TOTP. Only a hash of the browser token is
-- stored; revoking a device is a row delete. Service-role only.

create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.trusted_devices enable row level security;
revoke all on public.trusted_devices from anon, authenticated;

create index if not exists idx_trusted_devices_user on public.trusted_devices(user_id);
create index if not exists idx_trusted_devices_expiry on public.trusted_devices(expires_at);
