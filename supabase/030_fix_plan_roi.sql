-- 030_fix_plan_roi.sql
-- Corrects 029: the daily credits there were for a 0.1% return, not 10%.
-- Member ROI now varies by tier at $0.07949/DOGE. Daily credit = price x (1 + ROI) / days / rate.
-- The house funds the shortfall after processor + affiliate fees on every plan.
-- Rows are matched by plan_name; no rig is attached to any of them yet.

begin;

update public.plans set point_per_day = 1.88702982, earning_rate = 0.00131044, profit = '+5% ROI in 7 days'
 where plan_name = 'Bronze Plan';
update public.plans set point_per_day = 4.48693756, earning_rate = 0.00311593, profit = '+7% ROI in 15 days'
 where plan_name = 'Silver Plan';
update public.plans set point_per_day = 4.57080555, earning_rate = 0.00317417, profit = '+9% ROI in 30 days'
 where plan_name = 'Gold Plan';
update public.plans set point_per_day = 11.63668386, earning_rate = 0.00808103, profit = '+11% ROI in 30 days'
 where plan_name = 'Premium Plan';
update public.plans set point_per_day = 23.69270768, earning_rate = 0.01645327, profit = '+13% ROI in 30 days'
 where plan_name = 'Plus Plan';
update public.plans set point_per_day = 48.22409527, earning_rate = 0.03348896, profit = '+15% ROI in 30 days'
 where plan_name = 'Pro Plan';

commit;
