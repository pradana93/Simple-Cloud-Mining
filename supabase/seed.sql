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
  ('Is the free plan really free?','<p>Yes. The starter plan activates when you create an account. It needs no card and no payment. The current daily credit is shown on the plan card.</p>'),
  ('How does crypto payment work?','<p>Pick a coin and create an invoice. Send the exact amount shown to the deposit address. The miner activates after the network confirms the payment.</p>'),
  ('Which coins can I pay with?','<p>The checkout lists the coins that are available right now. Send only the selected coin on the correct network.</p>'),
  ('When does my miner activate?','<p>After the payment reaches the required confirmations. The invoice page updates automatically, and the credit lands in your balance.</p>'),
  ('When can I withdraw?','<p>When your balance meets the minimum shown on the withdrawal page. Withdrawals are reviewed and paid by hand.</p>'),
  ('What happens if I send the wrong coin or amount?','<p>The payment may not be credited. Send only the selected coin on the correct network, and send the exact amount. If you make a mistake, contact support with the transaction id.</p>'),
  ('Is the projected yield guaranteed?','<p>No. The projection uses the plan published daily rate for its full term. It is not a market forecast or a guarantee.</p>'),
  ('Do you store my private key?','<p>No. The app never asks for a wallet private key. Deposits go to a generated address and withdrawals are paid from an external wallet.</p>')
on conflict do nothing;

insert into public.addons (name) values ('demo_addon') on conflict do nothing;
insert into public.addons_menu (slug, name, route, icon) values ('demo_addon','Demo Addon','demo_addon','fa-cube') on conflict do nothing;
