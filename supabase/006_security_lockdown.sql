-- 006_security_lockdown.sql
-- The `for all using (auth.uid() = <owner>)` policies let any signed-in member
-- write their own balance, is_admin flag and ledger rows straight through
-- PostgREST with the public anon key. Revoke client write access and expose
-- SELECT-only, own-row policies. Every mutation now goes through a service-role
-- API route. Applied AFTER the matching app deploy.

-- profiles: read own row; no direct client writes (balance / is_admin live here).
drop policy if exists "own profile" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
revoke insert, update, delete, truncate, references, trigger on public.profiles from anon, authenticated;

-- user_plan_history: read own only (rigs mint accrual).
drop policy if exists "own plans" on public.user_plan_history;
create policy "read own plans" on public.user_plan_history for select using (auth.uid() = user_id);
revoke insert, update, delete, truncate, references, trigger on public.user_plan_history from anon, authenticated;

-- user_deposits: read own only (fake SUCCESS rows pollute the public feed).
drop policy if exists "own deposits" on public.user_deposits;
create policy "read own deposits" on public.user_deposits for select using (auth.uid() = user_id);
revoke insert, update, delete, truncate, references, trigger on public.user_deposits from anon, authenticated;

-- user_withdrawal: read own only (no self-approve / edit / delete).
drop policy if exists "own withdrawals" on public.user_withdrawal;
create policy "read own withdrawals" on public.user_withdrawal for select using (auth.uid() = user_id);
revoke insert, update, delete, truncate, references, trigger on public.user_withdrawal from anon, authenticated;

-- transactions_history: read own only (no forged paid invoices).
drop policy if exists "own tx" on public.transactions_history;
create policy "read own tx" on public.transactions_history for select using (auth.uid() = user_id);
revoke insert, update, delete, truncate, references, trigger on public.transactions_history from anon, authenticated;

-- affiliate_history: already select-only policy; strip any leftover write grants.
revoke insert, update, delete, truncate, references, trigger on public.affiliate_history from anon, authenticated;

-- settings: public read of everything except SMTP credentials.
drop policy if exists "public read settings" on public.settings;
create policy "read settings" on public.settings for select using (true);
revoke select on public.settings from anon, authenticated;
grant select (
  id, sitename, siteslogan, keywords, description, pagination, max_pending_transactions,
  min_withdraw, max_withdraw, aff_comission, currency_name, currency_symbol, currency_code,
  currency_decimals, coin_cur1, coin_cur2, coin_mode, coin_email,
  facebook, telegram, twitter, vk, wallet_min, wallet_max, blockchain, theme, start_date,
  show_start_date, start_date_increment, header_codes, footer_codes
) on public.settings to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.settings from anon, authenticated;

-- login_attempts: back the login throttle; service-role only.
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
create index if not exists idx_login_attempts_login_time on public.login_attempts(login, time);
