-- 013_saas.sql
-- Premium SaaS layer: announcement banner, daily check-in bonus, buyer coin
-- choice, default theme, auto-payout settings, plus the audit and payout event
-- tables that back the admin tools. All additive.

alter table public.settings
  add column if not exists announce_enabled boolean not null default false,
  add column if not exists announce_text text,
  add column if not exists announce_link text,
  add column if not exists checkin_enabled boolean not null default false,
  add column if not exists checkin_amount numeric(20,8) not null default 0,
  add column if not exists pay_coins text not null default 'BTC,DOGE,LTC,ETH,USDT,TRX',
  add column if not exists default_theme text not null default 'dark',
  add column if not exists auto_payout_enabled boolean not null default false,
  add column if not exists auto_payout_max numeric(20,8) not null default 0;

grant select (
  announce_enabled, announce_text, announce_link,
  checkin_enabled, checkin_amount, pay_coins, default_theme,
  auto_payout_enabled, auto_payout_max
) on public.settings to anon, authenticated;

create table if not exists public.checkins (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  amount numeric(20,8) not null,
  streak integer not null default 1,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists idx_checkins_user on public.checkins(user_id, day desc);
alter table public.checkins enable row level security;
drop policy if exists "read own checkins" on public.checkins;
create policy "read own checkins" on public.checkins for select using (auth.uid() = user_id);
grant select on public.checkins to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.checkins from anon, authenticated;

-- Who did what in the admin, kept forever.
create table if not exists public.admin_audit (
  id bigserial primary key,
  actor_id uuid,
  actor_name text,
  action text not null,
  target text,
  detail jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_created on public.admin_audit(created_at desc);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- Trail for payout automation and reconciliation.
create table if not exists public.payout_events (
  id bigserial primary key,
  withdrawal_id bigint,
  event text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_payout_events_w on public.payout_events(withdrawal_id);
alter table public.payout_events enable row level security;
revoke all on public.payout_events from anon, authenticated;
