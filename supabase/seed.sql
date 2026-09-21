-- Seed data ported from CodeIgniter migrations. Run AFTER schema.sql.

insert into public.groups (name, description) values
  ('admin','Administrator'),
  ('members','General User')
on conflict (name) do nothing;

insert into public.plans (plan_name, is_default, point_per_day, version, earning_rate, image, price, duration, profit, speed) values
  ('Free Plan', true, 0.02, 'V 1.0', 0.00001389, '1.png', 0, 1825, '2', '1'),
  ('Plan V1.1', false, 15, 'V 1.1', 0.01041667, '2.png', 0.03, 90, '5', '10'),
  ('Plan V1.2', false, 53, 'V 1.2', 0.03680556, '3.png', 1000, 90, '5.25', '100')
on conflict do nothing;

insert into public.urlchains (name, url) values
  ('DogeChain(DOGE)','https://dogechain.info/tx/'),
  ('Blockchain(BTC)','https://www.blockchain.com/btc/tx/'),
  ('Etherchain(ETH)','https://www.etherchain.org/tx/'),
  ('Litecoin Explorer(LTC)','http://explorer.litecoin.net/tx/'),
  ('Chainso(ZEC)','https://chain.so/tx/ZEC/'),
  ('Chainso(DASH)','https://chain.so/tx/DASH/'),
  ('TronScan','https://tronscan.org/#/transaction/'),
  ('BscScan','https://bscscan.com/tx/')
on conflict do nothing;

insert into public.settings (sitename, siteslogan, currency_name, currency_symbol, currency_code, currency_decimals, min_withdraw, max_withdraw, aff_comission, max_pending_transactions, coin_cur1, coin_cur2, coin_mode, coin_email, theme, start_date)
values ('Simple Cloud Mining','Invest like rich','Dogecoin','Ð','DOGE',8,0,100,2,3,'DOGE','DOGE','gateway','user','dogeminer', CURRENT_DATE)
on conflict do nothing;

insert into public.contents (affiliate, payouts, contact) values
  ('<p>Invite friends and earn commission on every upgrade.</p>','<p>Latest payouts from our miners.</p>','<p>Contact us and we will reply shortly.</p>')
on conflict do nothing;

insert into public.faqs (question, answer) values
  ('What is Simple Cloud Mining?','<p>Industry leading cloud mining pool. Mining power is backed by physical miners.</p>'),
  ('How do I start?','<p>Sign up and start generating coins. Upgrade plans to earn more.</p>'),
  ('How much can I earn?','<p>Free plan generates daily rewards. Paid plans increase hashrate.</p>'),
  ('How long do withdrawals take?','<p>Usually instant; manual review can take longer.</p>')
on conflict do nothing;

insert into public.addons (name) values ('demo_addon') on conflict do nothing;
insert into public.addons_menu (slug, name, route, icon) values ('demo_addon','Demo Addon','demo_addon','fa-cube') on conflict do nothing;
