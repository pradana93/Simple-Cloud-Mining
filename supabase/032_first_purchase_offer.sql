-- 032_first_purchase_offer.sql
-- Optional one-time discount on a member's first paid plan. Default 0, so no
-- price changes until an admin opts in. Eligibility is per account: any prior
-- paid invoice removes it. Crypto has no payment-method identity, so this
-- cannot stop the same person creating a new account; the cap and audit trail
-- are the guardrails.

alter table public.settings
  add column if not exists first_purchase_discount_percent numeric(6,2) not null default 0;

alter table public.settings
  drop constraint if exists settings_first_purchase_discount_range;
alter table public.settings
  add constraint settings_first_purchase_discount_range
  check (first_purchase_discount_percent >= 0 and first_purchase_discount_percent <= 50);
