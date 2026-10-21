-- 023_cryptapi.sql
-- CryptAPI looks up invoices by the unique deposit address carried in the
-- signed webhook. Keep that lookup cheap as the invoice table grows.

create index if not exists idx_transactions_provider_address
  on public.transactions_history ((params->>'address'))
  where params->>'provider' = 'cryptapi';
