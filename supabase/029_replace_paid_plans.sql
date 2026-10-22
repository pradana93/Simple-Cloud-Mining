-- 029_replace_paid_plans.sql
-- Replace the paid ladder with six plans priced from a 10% member return at
-- $0.07949/DOGE. The house funds the shortfall after processor + affiliate fees
-- (about -2.35% margin per plan); this is deliberate, not a profit claim.
-- Free plan is untouched. Bronze has no rigs attached, so it is safe to remove.

begin;

delete from public.plans where id = 5 and not exists (
  select 1 from public.user_plan_history h where h.plan_id = 5
);

insert into public.plans
  (plan_name, is_default, point_per_day, version, earning_rate, image, price, duration, profit, speed)
values
  ('Bronze Plan', false, 1.79896842, 'Bronze', 0.00124928, '1.png', 1, 7, '+10% ROI in 7 days', '1'),
  ('Silver Plan', false, 4.19759299, 'Silver', 0.00291500, '1.png', 5, 15, '+10% ROI in 15 days', '5'),
  ('Gold Plan', false, 4.19759299, 'Gold', 0.00291500, '1.png', 10, 30, '+10% ROI in 30 days', '10'),
  ('Premium Plan', false, 10.49398247, 'Premium', 0.00728749, '1.png', 25, 30, '+10% ROI in 30 days', '25'),
  ('Plus Plan', false, 20.98796494, 'Plus', 0.01457497, '1.png', 50, 30, '+10% ROI in 30 days', '50'),
  ('Pro Plan', false, 41.97592989, 'Pro', 0.02914994, '1.png', 100, 30, '+10% ROI in 30 days', '100');

commit;
