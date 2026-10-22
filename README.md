# Simple Cloud Mining — Modern TypeScript Stack

Migrated from [`pradana93/Simple-Cloud-Mining`](https://github.com/pradana93/Simple-Cloud-Mining)
(CodeIgniter 3 / PHP — SCM v3.15.0) to a premium TypeScript stack:

- **Next.js 15** App Router + TypeScript + Tailwind CSS
- **Supabase** — Postgres, Auth, RLS (replaces Ion Auth + MySQL)
- **Vercel Cron** — mining accrual every 5 min (replaces per-request balance updates)
- **CryptAPI** — non-custodial deposit addresses with RSA-signed webhooks

## Deepscan summary (legacy → modern)

| Legacy (PHP) | Modern (TS) |
|---|---|
| `Welcome` (home, referral, affiliate, faq, payouts, contact) | `app/page.tsx`, `app/affiliate`, `app/faq`, `app/payouts`, `app/contact`, `app/referral/[uniqueId]` |
| `Account` (dashboard, history, withdrawal, purchase, invoice) | `app/dashboard`, `app/account`, `app/withdrawal`, `app/purchase/[planId]` (`app/api/purchase`), `app/invoice/[hash]` |
| `Ajaxauth` (login/register) | Supabase Auth — `app/login`, `app/register` |
| `GatewayIpn` (legacy) | `app/api/webhooks/cryptapi/route.ts` (RSA-SHA256 verify, status machine pending→waiting→paid, deposit + plan activation + upline commission) |
| `Users_model::updateUserBalance/updateUserMiningSpeed` | `lib/mining.ts` (`accrueForPlan`) + `app/api/cron/accrue/route.ts` |
| Admin controllers (Admins, Plans, Users, Transactions, Withdrawals, Settings, Faqs, Contact, Ipnlogs, Urlchains, Contents) | `app/admin/*` |
| 20 CodeIgniter migrations | `supabase/schema.sql` + `supabase/seed.sql` |

## Setup

See [docs/INSTALL.md](docs/INSTALL.md) for the full guide. The short version:

1. `npm install`
2. `npm run setup` — the wizard writes `.env.local` and applies every file in
   `supabase/`, in order, through the Supabase API
3. `npm run dev` — sign up at `/register`, then run
   `npm run make-admin -- you@example.com`
4. Deploy to Vercel (or Docker) with the same env vars. CryptAPI callbacks go
   to `https://YOUR-DOMAIN/api/webhooks/cryptapi` automatically.

`vercel.json` schedules five daily jobs: `/api/cron/accrue`, `/api/cron/risk`,
`/api/cron/security`, `/api/cron/payouts` and `/api/cron/ledger`. Per-request
accrual in `lib/accrue-user.ts` keeps balances fresh between runs. The ledger
job alerts when stored balances drift from the append-only ledger.

## Docs and tooling

| File | Purpose |
|---|---|
| [docs/INSTALL.md](docs/INSTALL.md) | Installation and deploy guide |
| [docs/BUYER-README.md](docs/BUYER-README.md) | What ships with a license |
| [LICENSE.txt](LICENSE.txt) | License template to adapt before selling |
| `scripts/install.mjs` | Setup wizard (`npm run setup`) |
| `scripts/make-admin.mjs` | Promote an account (`npm run make-admin`) |
| `scripts/logical-backup.mjs` | Encrypted application backup (`npm run backup`) |
| [docs/RESTORE.md](docs/RESTORE.md) | Backup posture and restore drill |
| `playwright.config.ts`, `tests/e2e` | Public and signed-in browser baseline (`npm run test:e2e`) |
| `scripts/package.mjs` | Build the buyer zip (`npm run bundle`) |
| `Dockerfile`, `docker-compose.yml` | Self-host option |

## Security notes

- Never commit `.env` / `.env.local` (gitignored). Only `.env.example` with placeholders is tracked.
- Rotate any secret that was ever pasted into a chat.
- `/admin` is guarded server-side in `app/admin/layout.tsx`, with a fast
  redirect in `middleware.ts`. Set `is_admin = true` only on your own account
  (`npm run make-admin`).
- `006_security_lockdown.sql` revokes client write access to money tables, so
  balances, withdrawals and invoices can only change through the service-role
  API routes.
- `022_security_payout_atomicity.sql` adds atomic withdrawal settlement and
  locks the legacy CMS tables. Apply every migration in order.
- Admin API routes require TOTP enrollment plus a fresh authenticator code.
  Enroll before relying on admin tools.
- Set the Supabase Auth site URL and redirect allow-list to the production
  domain, including `/reset-password`, so email reset links work.
- Set at least one CryptAPI receiving address in Admin > Settings > Payments or
  via `CRYPTAPI_*_ADDRESS`. The checkout hides coins without an address. USDT
  TRC20 needs its own address, separate from the TRX address, and has a 10 USDT
  minimum. The webhook verifies CryptAPI's RSA signature.
- Backups are encrypted locally. Set `BACKUP_UPLOAD_URL` (and optional
  `BACKUP_UPLOAD_TOKEN`) to copy each backup offsite.
- Admin > Settings > **Reset app progression** clears members and activity while
  keeping admin accounts, settings, plans, content, payment addresses, and the
  audit log. It requires a fresh authenticator check and typing `RESET`.
