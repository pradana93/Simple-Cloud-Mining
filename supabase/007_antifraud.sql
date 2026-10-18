-- 007_antifraud.sql
-- Deterministic anti-fraud telemetry and scoring. No automatic enforcement:
-- the engine only produces a score + reasons that an admin reviews.
--
-- risk_events   : append-only signal log (login / accrue / withdraw / deposit).
--                 IPs are stored as salted hashes, never raw.
-- account_risk  : latest score per member, rebuilt by the risk cron / admin rescan.

create table if not exists public.risk_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  ip_hash text,
  subnet_hash text,
  ua_hash text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_risk_events_user_kind_time on public.risk_events(user_id, kind, created_at);
create index if not exists idx_risk_events_subnet on public.risk_events(subnet_hash);
create index if not exists idx_risk_events_ip on public.risk_events(ip_hash);

create table if not exists public.account_risk (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  score numeric(6,2) not null default 0,
  band text not null default 'low' check (band in ('low', 'medium', 'high')),
  reasons jsonb not null default '[]'::jsonb,
  state text not null default 'open' check (state in ('open', 'dismissed', 'cleared')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists idx_account_risk_score on public.account_risk(score desc);
create index if not exists idx_account_risk_state on public.account_risk(state);

alter table public.risk_events enable row level security;
alter table public.account_risk enable row level security;
revoke all on public.risk_events from anon, authenticated;
revoke all on public.account_risk from anon, authenticated;

-- Support the referral-fanout and address-cluster scans.
create index if not exists idx_profiles_reference on public.profiles(reference_user_id);
create index if not exists idx_withdrawal_address on public.user_withdrawal(address);
