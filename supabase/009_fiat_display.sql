-- 009_fiat_display.sql
-- Fiat display toggle. Members can read balances and plan prices in USD,
-- converted from the site's crypto currency at render time. Stored values stay
-- in crypto; the live rate is fetched and cached by the app, not persisted here.

alter table public.settings
  add column if not exists fiat_enabled boolean not null default false,
  add column if not exists fiat_currency text not null default 'USD';

grant select (fiat_enabled, fiat_currency) on public.settings to anon, authenticated;
