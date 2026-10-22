-- 027_reset_safe_delete.sql
-- Supabase enables the safe-update guard, which rejects unfiltered DELETE
-- statements even inside a function. Re-create the reset RPC with an explicit
-- WHERE clause on every delete so production matches the intended behavior.

create or replace function public.reset_app_progress()
returns table (
  members_removed bigint,
  invoices_removed bigint,
  deposits_removed bigint,
  withdrawals_removed bigint,
  games_removed bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_members bigint := 0;
  v_invoices bigint := 0;
  v_deposits bigint := 0;
  v_withdrawals bigint := 0;
  v_games bigint := 0;
begin
  select count(*) into v_invoices from public.transactions_history;
  select count(*) into v_deposits from public.user_deposits;
  select count(*) into v_withdrawals from public.user_withdrawal;
  select count(*) into v_games from public.game_rounds;

  delete from public.payout_events where true;
  delete from public.ipn_errors where true;
  delete from public.login_attempts where true;
  delete from public.login_pending_2fa where true;
  delete from public.security_checks where true;
  delete from public.risk_events where true;
  delete from public.account_risk where true;
  delete from public.chat_messages where true;
  delete from public.contact where true;
  delete from public.addons_menu where true;
  delete from public.addons where true;
  delete from public.addon_demo where true;
  delete from public.game_seed_reveals where true;
  delete from public.game_bets where true;
  delete from public.game_rounds where true;
  delete from public.crash_rounds where true;
  delete from public.game_seeds where true;
  delete from public.checkins where true;
  delete from public.affiliate_history where true;
  -- The ledger is append-only during normal operation. A reset is the one
  -- explicit exception; the disable/enable pair is transactional with the
  -- function call, so a failure cannot leave the trigger off.
  alter table public.balance_ledger disable trigger balance_ledger_append_only;
  delete from public.balance_ledger where true;
  alter table public.balance_ledger enable trigger balance_ledger_append_only;
  delete from public.withdrawal_allowlist where true;
  delete from public.user_deposits where true;
  delete from public.user_withdrawal where true;
  delete from public.user_plan_history where true;
  delete from public.transactions_history where true;

  delete from auth.users
   where id not in (select p.id from public.profiles p where p.is_admin is true);
  get diagnostics v_members = row_count;

  update public.profiles
     set balance = 0,
         cashouts = 0,
         affiliate_earns = 0,
         affiliate_paid = 0,
         reference_user_id = null
   where is_admin is true;

  return query select v_members, v_invoices, v_deposits, v_withdrawals, v_games;
end;
$$;

revoke all on function public.reset_app_progress() from public;
revoke all on function public.reset_app_progress() from anon, authenticated;
grant execute on function public.reset_app_progress() to service_role;
