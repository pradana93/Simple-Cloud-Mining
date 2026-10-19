-- 011_withdrawal_allowlist.sql
-- Members can pin the wallet addresses they trust. Once at least one address is
-- saved, a payout request is refused unless the destination matches it, so a
-- hijacked session cannot redirect funds somewhere new. Reads are own-row and
-- every write goes through the service-role API route.

create table if not exists public.withdrawal_allowlist (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  currency text not null default 'DOGE',
  address text not null,
  created_at timestamptz not null default now(),
  unique (user_id, currency, address)
);

create index if not exists idx_allowlist_user on public.withdrawal_allowlist(user_id);

alter table public.withdrawal_allowlist enable row level security;

drop policy if exists "read own allowlist" on public.withdrawal_allowlist;
create policy "read own allowlist" on public.withdrawal_allowlist for select using (auth.uid() = user_id);

grant select on public.withdrawal_allowlist to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.withdrawal_allowlist from anon, authenticated;
