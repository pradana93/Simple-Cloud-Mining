-- 024_payment_addresses.sql
-- Public CryptAPI receiving addresses. These are not secrets: checkout shows
-- the generated deposit address, and funds forward to these wallets. The admin
-- settings page edits them; environment variables still take precedence.

alter table public.settings
  add column if not exists cryptapi_btc_address text,
  add column if not exists cryptapi_ltc_address text,
  add column if not exists cryptapi_doge_address text,
  add column if not exists cryptapi_eth_address text,
  add column if not exists cryptapi_trx_address text,
  add column if not exists cryptapi_usdt_trc20_address text;

grant select (
  cryptapi_btc_address,
  cryptapi_ltc_address,
  cryptapi_doge_address,
  cryptapi_eth_address,
  cryptapi_trx_address,
  cryptapi_usdt_trc20_address
) on public.settings to anon, authenticated;
