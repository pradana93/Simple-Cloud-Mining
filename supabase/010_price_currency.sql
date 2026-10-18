-- 010_price_currency.sql
-- Plans are priced in a stable fiat currency so the storefront reads sensibly
-- to a global audience. Checkout bills the invoice in this currency through
-- CoinPayments, which converts and lets the buyer pay with any coin.
-- Earnings and balances stay in the site's crypto currency.

alter table public.settings
  add column if not exists price_currency text not null default 'USD';

grant select (price_currency) on public.settings to anon, authenticated;

-- Purchases are billed in the price currency but the ledger stays in the site
-- crypto (the unit balances, withdrawals and deposits already use). Keep the
-- billed amount so the IPN can validate the payment against what was invoiced.
alter table public.transactions_history
  add column if not exists price_amount numeric(20,8),
  add column if not exists price_currency varchar(8);

-- Seed the two paid plans with sensible USD prices (free plan stays 0).
update public.plans set price = 5.00 where id = 2;
update public.plans set price = 50.00 where id = 3;
