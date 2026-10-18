-- 004: record the payout destination on every withdrawal request so the
-- operator can see exactly where the funds should be sent, and members can
-- confirm the address they used.
alter table public.user_withdrawal add column if not exists address text;

create index if not exists idx_withdrawal_status on public.user_withdrawal(status);
