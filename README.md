# Simple Cloud Mining — Modern TypeScript Stack

Migrated from [`pradana93/Simple-Cloud-Mining`](https://github.com/pradana93/Simple-Cloud-Mining)
(CodeIgniter 3 / PHP — SCM v3.15.0) to a premium TypeScript stack:

- **Next.js 14** App Router + TypeScript + Tailwind CSS
- **Supabase** — Postgres, Auth, RLS (replaces Ion Auth + MySQL)
- **Vercel Cron** — mining accrual every 5 min (replaces per-request balance updates)
- **CoinPayments** — Gateway + API modes with HMAC-verified IPN route

## Deepscan summary (legacy → modern)

| Legacy (PHP) | Modern (TS) |
|---|---|
| `Welcome` (home, referral, affiliate, faq, payouts, contact) | `app/page.tsx`, `app/affiliate`, `app/faq`, `app/payouts`, `app/contact`, `app/referral/[uniqueId]` |
| `Account` (dashboard, history, withdrawal, purchase, invoice) | `app/dashboard`, `app/account`, `app/withdrawal`, `app/purchase/[planId]` (`app/api/purchase`), `app/invoice/[hash]` |
| `Ajaxauth` (login/register) | Supabase Auth — `app/login`, `app/register` |
| `GatewayIpn::coinpayments` | `app/api/ipn/coinpayments/route.ts` (HMAC-SHA512 verify, status machine pending→waiting→paid/canceled, deposit + plan activation + upline commission) |
| `Users_model::updateUserBalance/updateUserMiningSpeed` | `lib/mining.ts` (`accrueForPlan`) + `app/api/cron/accrue/route.ts` |
| Admin controllers (Admins, Plans, Users, Transactions, Withdrawals, Settings, Faqs, Contact, Ipnlogs, Urlchains, Contents) | `app/admin/*` |
| 20 CodeIgniter migrations | `supabase/schema.sql` + `supabase/seed.sql` |

## Setup

1. **Supabase** — in SQL Editor run `supabase/schema.sql`, then `supabase/seed.sql`.
   Create an admin user via Authentication, then set `profiles.is_admin = true` for your id.
2. **Env** — copy `.env.example` to `.env.local` and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `COINPAYMENTS_MERCHANT_ID`, `COINPAYMENTS_IPN_SECRET`, (+ API keys if `coin_mode=api`)
   - `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`
3. **Run** — `npm install`, `npm run dev`. Verify with `npm run build`.
4. **Deploy (Vercel)** — import repo, add the same env vars, deploy. Cron (`vercel.json`) hits `/api/cron/accrue` every 5 min; set `CRON_SECRET`. CoinPayments IPN URL: `https://YOUR-DOMAIN/api/ipn/coinpayments`.

## Security notes

- Never commit `.env` / `.env.local` (gitignored). Only `.env.example` with placeholders is tracked.
- Rotate any secret that was ever pasted into chat.
- Protect `/admin` with an `is_admin` check before production (layout currently lists pages; add a server-side guard).
