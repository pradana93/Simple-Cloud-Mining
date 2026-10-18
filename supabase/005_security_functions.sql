-- 005_security_functions.sql
-- Atomic balance mutation helpers. Money paths call these with the service-role
-- client so a balance change is a single guarded UPDATE (no read-modify-write race).
-- Execute is service-role only; the anon/authenticated keys cannot call them.

create or replace function public.debit_balance(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then
    return null;
  end if;
  update public.profiles
     set balance = balance - p_amount
   where id = p_user_id
     and balance >= p_amount
  returning balance into new_balance;
  -- null means the guard failed: unknown member or insufficient balance
  return new_balance;
end;
$$;

create or replace function public.credit_balance(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance numeric;
begin
  if p_amount is null or p_amount = 0 then
    select balance into new_balance from public.profiles where id = p_user_id;
    return new_balance;
  end if;
  update public.profiles
     set balance = balance + p_amount
   where id = p_user_id
  returning balance into new_balance;
  if new_balance is null then
    select balance into new_balance from public.profiles where id = p_user_id;
  end if;
  return new_balance;
end;
$$;

revoke all on function public.debit_balance(uuid, numeric) from public;
revoke all on function public.credit_balance(uuid, numeric) from public;
revoke all on function public.debit_balance(uuid, numeric) from anon, authenticated;
revoke all on function public.credit_balance(uuid, numeric) from anon, authenticated;
grant execute on function public.debit_balance(uuid, numeric) to service_role;
grant execute on function public.credit_balance(uuid, numeric) to service_role;
