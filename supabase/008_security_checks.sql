-- 008_security_checks.sql
-- Watchdog for the RLS lockdown. The security cron re-probes the public (anon)
-- surface and records the latest result per check here. A `passed = false` row
-- means a grant or policy regressed and the hole is back open.
--
-- security_checks : one row per probe, upserted on each run.

create table if not exists public.security_checks (
  check_key text primary key,
  label text not null,
  passed boolean not null,
  detail text,
  checked_at timestamptz not null default now()
);

alter table public.security_checks enable row level security;
revoke all on public.security_checks from anon, authenticated;
