-- 034_grant_first_purchase_settings.sql
-- 032 added first_purchase_discount_percent but did not grant it to anon or
-- authenticated. The public settings select includes that column, so PostgREST
-- denied the whole row and the app silently fell back to defaults: fiat off,
-- zero conversion rate, no payment addresses. That made break-even render as
-- "not applicable", totals show zero, and checkout show as unavailable.

grant select (first_purchase_discount_percent) on public.settings to anon, authenticated;
