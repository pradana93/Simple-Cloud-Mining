-- Simple Cloud Mining → Supabase (Postgres) schema
-- Ported from CodeIgniter migrations 001–020. Run in Supabase SQL Editor.
-- Profiles are linked to auth.users (id uuid).

-- Extensions
create extension if not exists "pgcrypto";

-- PROFILES (replaces legacy `users` table; auth handled by Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text,
  unique_id int unique not null,
  balance numeric(30,8) not null default 0,
  cashouts numeric(30,8) not null default 0,
  reference_user_id uuid references public.profiles(id) on delete set null,
  affiliate_earns numeric(30,8) not null default 0,
  affiliate_paid numeric(30,8) not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- GROUPS
create table if not exists public.groups (
  id bigint generated always as identity primary key,
  name varchar(20) unique not null,
  description varchar(191) not null
);

create table if not exists public.profile_groups (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id bigint not null references public.groups(id) on delete cascade,
  unique(user_id, group_id)
);

-- PLANS
create table if not exists public.plans (
  id bigint generated always as identity primary key,
  plan_name varchar(50) not null,
  is_default boolean not null default false,
  point_per_day numeric(20,8),
  version varchar(30),
  earning_rate numeric(20,8),
  image varchar(100) not null default '1.png',
  price numeric(20,8) not null default 0,
  duration int not null default 30,
  profit varchar(191),
  speed varchar(191) not null default '1'
);

-- USER PLAN HISTORY
create table if not exists public.user_plan_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id bigint not null references public.plans(id) on delete restrict,
  status varchar(50) not null default 'inactive',
  created_at timestamptz not null default now(),
  expire_date timestamptz,
  last_sum timestamptz
);
create index if not exists idx_uph_user on public.user_plan_history(user_id);
create index if not exists idx_uph_status on public.user_plan_history(status);

-- DEPOSITS
create table if not exists public.user_deposits (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(20,8) not null,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','SUCCESS')),
  tx varchar(191),
  created_at timestamptz not null default now(),
  date_paid timestamptz
);

-- WITHDRAWALS
create table if not exists public.user_withdrawal (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type varchar(50) not null default 'payment',
  amount numeric(20,8) not null,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','SUCCESS','CANCELED')),
  tx varchar(191),
  created_at timestamptz not null default now(),
  date_paid timestamptz
);

-- TRANSACTIONS (CoinPayments invoices)
create table if not exists public.transactions_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id bigint not null references public.plans(id) on delete restrict,
  amount numeric(20,8) not null,
  paid_amount numeric(20,8),
  status varchar(50) not null default 'pending' check (status in ('pending','waiting','paid','canceled')),
  hash varchar(191) unique,
  txid varchar(191),
  params jsonb,
  date timestamptz not null default now()
);
create index if not exists idx_tx_user on public.transactions_history(user_id);
create index if not exists idx_tx_status on public.transactions_history(status);

-- AFFILIATE HISTORY
create table if not exists public.affiliate_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(30,8) not null,
  status varchar(50) not null default 'paid',
  date timestamptz not null default now()
);

-- SETTINGS (single-row app config; secrets stay in env, not here)
create table if not exists public.settings (
  id bigint generated always as identity primary key,
  sitename varchar(191) not null default 'Simple Cloud Mining',
  siteslogan varchar(191) not null default 'Invest like rich',
  keywords varchar(191) not null default 'cloud,mining,crypto',
  description varchar(191) not null default 'Simple Cloud Mining',
  pagination int not null default 10,
  max_pending_transactions int not null default 3,
  min_withdraw numeric(20,8) not null default 0,
  max_withdraw numeric(20,8) not null default 100,
  aff_comission int not null default 2,
  currency_name varchar(191) not null default 'Dogecoin',
  currency_symbol varchar(10) not null default 'Ð',
  currency_code varchar(10) not null default 'DOGE',
  currency_decimals int not null default 8,
  coin_cur1 varchar(20) not null default 'DOGE',
  coin_cur2 varchar(20) not null default 'DOGE',
  coin_mode text not null default 'gateway' check (coin_mode in ('api','gateway')),
  coin_email text not null default 'user' check (coin_email in ('user','admin')),
  smtp_host varchar(191),
  smtp_user varchar(191),
  smtp_pass varchar(191),
  smtp_port int,
  smtp_secure text not null default 'null',
  smtp_sender varchar(191),
  facebook varchar(191),
  telegram varchar(191),
  twitter varchar(191),
  vk varchar(191),
  wallet_min int not null default 20,
  wallet_max int not null default 50,
  blockchain int not null default 1,
  theme varchar(191) not null default 'dogeminer',
  start_date date,
  show_start_date text not null default 'no',
  start_date_increment int not null default 0,
  header_codes text,
  footer_codes text
);

-- CONTENTS / FAQS / CONTACT / URLCHAINS
create table if not exists public.contents (
  id bigint generated always as identity primary key,
  affiliate text,
  payouts text,
  contact text
);

create table if not exists public.faqs (
  id bigint generated always as identity primary key,
  question varchar(191) not null,
  answer text not null
);

create table if not exists public.contact (
  id bigint generated always as identity primary key,
  name varchar(191) not null,
  email varchar(191) not null,
  subject varchar(191) not null,
  message text not null,
  created_at timestamptz not null default now(),
  status text not null default 'unread' check (status in ('unread','read','replied'))
);

create table if not exists public.urlchains (
  id bigint generated always as identity primary key,
  name varchar(191) not null,
  url varchar(191) not null
);

-- IPN ERRORS (legacy inp_errors)
create table if not exists public.ipn_errors (
  id bigint generated always as identity primary key,
  transaction_id bigint references public.transactions_history(id) on delete set null,
  message varchar(191),
  content text,
  status varchar(191),
  created_at timestamptz not null default now()
);

create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  ip_address varchar(45),
  login varchar(191),
  time bigint
);

-- ADDONS (kept for parity; new code doesn't execute legacy PHP addons)
create table if not exists public.addons (
  id bigint generated always as identity primary key,
  name varchar(191) not null
);
create table if not exists public.addons_menu (
  id bigint generated always as identity primary key,
  slug varchar(191) not null,
  name varchar(191) not null,
  route varchar(191) not null,
  icon varchar(191) not null
);
create table if not exists public.addon_demo (
  id bigint generated always as identity primary key,
  key varchar(191) not null,
  value text
);

-- RLS
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.user_plan_history enable row level security;
alter table public.user_deposits enable row level security;
alter table public.user_withdrawal enable row level security;
alter table public.transactions_history enable row level security;
alter table public.affiliate_history enable row level security;
alter table public.settings enable row level security;
alter table public.contents enable row level security;
alter table public.faqs enable row level security;
alter table public.contact enable row level security;
alter table public.urlchains enable row level security;
alter table public.ipn_errors enable row level security;

-- Public read for catalog/content tables
drop policy if exists "public read plans" on public.plans;
create policy "public read plans" on public.plans for select using (true);
drop policy if exists "public read settings" on public.settings;
create policy "public read settings" on public.settings for select using (true);
drop policy if exists "public read faqs" on public.faqs;
create policy "public read faqs" on public.faqs for select using (true);
drop policy if exists "public read contents" on public.contents;
create policy "public read contents" on public.contents for select using (true);
drop policy if exists "public read urlchains" on public.urlchains;
create policy "public read urlchains" on public.urlchains for select using (true);

-- Users manage own rows
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "own plans" on public.user_plan_history;
create policy "own plans" on public.user_plan_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own deposits" on public.user_deposits;
create policy "own deposits" on public.user_deposits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own withdrawals" on public.user_withdrawal;
create policy "own withdrawals" on public.user_withdrawal for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own tx" on public.transactions_history;
create policy "own tx" on public.transactions_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own affiliate" on public.affiliate_history;
create policy "own affiliate" on public.affiliate_history for select using (auth.uid() = user_id);
drop policy if exists "insert contact" on public.contact;
create policy "insert contact" on public.contact for insert with check (true);
