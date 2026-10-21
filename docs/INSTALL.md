# Installation guide

Simple Cloud Mining is a Next.js 15 web app. It uses Supabase for the database
and login, and CryptAPI to take deposits. This guide takes you from the
downloaded folder to a running site, then to a live deploy.

Read time is about 15 minutes. The database and deploy steps are the only parts
that need careful attention.

## 1. What you need

| Item | Notes |
|---|---|
| Node.js 20.19 or newer | https://nodejs.org. The installer checks this. |
| A Supabase account | Free tier is enough to start. https://supabase.com |
| Crypto wallet addresses | Needed for real deposits. No CryptAPI account or KYC. |
| A host (optional at first) | Vercel has a free tier. Any Node host works. |
| A domain (optional) | Needed before you take live payments. |

You do not need to install Postgres. Supabase hosts it.

## 2. Install dependencies

Open a terminal in the project folder and run:

```
npm install
```

## 3. Run the setup wizard

```
npm run setup
```

The wizard walks through four steps:

1. **Supabase project.** Paste the Project URL and the anon and service role
   keys from Project Settings > API. It checks that the project answers.
2. **Database schema.** The wizard applies every file in `supabase/`, in order,
   through the Supabase Management API. It asks for a personal access token
   (create one at https://supabase.com/dashboard/account/tokens). This step is
   optional: you can skip it and run the SQL by hand (section 5).
3. **Site and automation.** Your site URL and the cron secret. Say yes to
   generate a strong secret.
4. **CryptAPI.** Public receiving addresses for the coins you accept. There is
   no account, API key, or KYC. Leave a coin blank to hide it at checkout.

The wizard writes `.env.local`. If that file already existed, the old copy is
kept next to it with a `.bak` suffix.

Check your file at any time with:

```
npm run setup:check
```

## 4. Start the app

```
npm run dev
```

Open http://localhost:3000. If the pages render and you can reach the register
screen, the environment is wired up.

## 5. Manual database setup (optional)

Use this if you skipped the wizard's database step or want to run the SQL
yourself. In the Supabase dashboard, open **SQL Editor** and run these files
from the `supabase/` folder, in this exact order. Paste one file at a time.

| Order | File | What it does |
|---|---|---|
| 1 | `schema.sql` | Tables, row level security policies |
| 2 | `002_auth_trigger.sql` | Creates a profile and a free plan on signup |
| 3 | `003_chat.sql` | Member to admin chat, plus the `is_admin` helper |
| 4 | `004_withdrawal_address.sql` | Stores the payout address on requests |
| 5 | `005_security_functions.sql` | Atomic balance credit and debit functions |
| 6 | `006_security_lockdown.sql` | Revokes client write access to money tables |
| 7 | `007_antifraud.sql` | Risk events and account risk tables |
| 8 | `008_security_checks.sql` | Security watchdog results table |
| 9 | `009_fiat_display.sql` | Fiat display toggle columns |
| 10 | `010_price_currency.sql` | Plan prices in a fiat currency |
| 11 | `011_withdrawal_allowlist.sql` | Member withdrawal address allowlist |
| 12 | `012_2fa.sql` | Two-factor auth tables |
| 13 | `013_saas.sql` | Announcement, check-in, audit log, payout events |
| 14 | `014_games.sql` | Provably fair casino tables and settings |
| 15 | `015_casino_control.sql` | Casino operator controls (extra edge, win cap, disabled games) |
| 16 | `016_casino_pro.sql` | Per-game overrides, player tiers, promo window, reporting |
| 17 | `017_game_profit.sql` | Per-game owner profit reporting |
| 18 | `018_crash.sql` | Live crash rounds and atomic cashout settlement |
| 19 | `seed.sql` | Starter plans, settings and sample content |

Order matters. Files 2 through 18 assume the tables from `schema.sql`, and
`006_security_lockdown.sql` assumes the functions from `005`.

## 6. Environment variables

Set these in `.env.local` for local work and in your host's dashboard for
deploys. `.env.example` lists them with comments.

| Variable | Required | Where to find it | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase Project Settings > API | Database and auth endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same screen | Public key, safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Same screen | Server key that bypasses row level security |
| `NEXT_PUBLIC_SITE_URL` | Yes | You choose it | Absolute URL for referrals and the payment callback |
| `CRON_SECRET` | Yes | You generate it | Guards the `/api/cron/*` routes |
| `CRYPTAPI_BTC_ADDRESS` | At least one | Your wallet | Bitcoin deposits |
| `CRYPTAPI_LTC_ADDRESS` | At least one | Your wallet | Litecoin deposits |
| `CRYPTAPI_DOGE_ADDRESS` | At least one | Your wallet | Dogecoin deposits |
| `CRYPTAPI_ETH_ADDRESS` | At least one | Your wallet | Ethereum deposits |
| `CRYPTAPI_TRX_ADDRESS` | At least one | Your wallet | TRON deposits |
| `CRYPTAPI_USDT_TRC20_ADDRESS` | At least one | Your wallet | USDT TRC20 deposits |
| `RISK_SALT` | No | You generate it | Salt for hashing IPs in anti-fraud data |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry project settings | Error reporting in the browser |
| `SENTRY_DSN` | No | Sentry project settings | Error reporting on the server and edge |
| `ALERT_WEBHOOK_URL` | No | Slack or Discord webhook | Money and ledger drift alerts |
| `BACKUP_ENCRYPTION_KEY` | Recommended | You generate 32+ random characters | Encrypts logical backups |
| `SUPABASE_ACCESS_TOKEN` | For backup checks | Supabase account settings | Reads native backup posture |
| `SMTP_SENDER` | No | Your mail provider | From address on outbound email |
| `OPENAI_API_KEY` | No | OpenAI | Powers the admin plan assistant |
| `ANTHROPIC_API_KEY` | No | Anthropic | Alternative provider for the plan assistant |
| `PLAN_AI_MODEL` | No | Provider docs | Overrides the assistant model name |

## 7. First login and admin access

1. Open http://localhost:3000/register and create an account. The signup trigger
   creates your profile and activates the free plan.
2. Promote that account to admin:

```
npm run make-admin -- you@example.com
```

You can also pass the username or the user id. List current admins with
`npm run make-admin -- --list`. After promoting, sign out and back in, then open
http://localhost:3000/admin.

The first admin account is the one that controls everything. Create it before
you invite real users.

## 8. Configure the store

Everything below lives in the admin area.

| Screen | Set this up |
|---|---|
| Settings | Site name, slogan, currency, minimum and maximum withdrawal, affiliate percent, withdrawal review mode |
| Plans | Price and daily yield for each plan. The free plan stays at 0. |
| Content | Affiliate, payouts and contact page copy |
| FAQ | Replace the sample questions with your own |
| Withdrawals | Review requests, reconcile the queue, record payout txids, see the audit trail |
| Analytics | Revenue, signups and conversion |
| Audit log | Who changed what, and when |

Two features are off until you enable them in Settings: the announcement banner
and the daily check-in bonus. Withdrawals are paid manually from your wallet.
The casino is off by default too:
turn on **Casino** in Settings and set a minimum and maximum bet before members
can play. The same section holds the basic operator controls: an extra house
edge, a per-round win cap, and a comma separated list of game ids to switch off.
For finer control open **Admin > Casino**. There you can set per-game edge, win
cap and bet bounds, define player tiers by lifetime wager, and run a promo window
that shifts the edge for a range of UTC hours. The panel also reports wagers,
payouts and hold for the last day and week, and owner profit for each game in
the same windows. These adjust the payout only. Every
round still resolves from the committed seed and the raw roll, pocket or draw is
stored, so members can keep verifying results.

## 9. Deploy

### Vercel

1. Push this folder to a Git repository you own.
2. Import the repository at https://vercel.com/new.
3. Add every variable from section 6 in Project Settings > Environment
   Variables. Use your live domain for `NEXT_PUBLIC_SITE_URL`.
4. Deploy.

`vercel.json` already declares the five scheduled jobs. Vercel calls them with
the `CRON_SECRET` you set.

### Any Node host or Docker

The app is a standard Next.js server. Build and run:

```
npm run build
npm run start
```

A `Dockerfile` and `docker-compose.yml` are included:

```
docker compose up --build
```

Set the same environment variables on the host. Scheduled jobs do not run by
themselves outside Vercel, so call these five URLs once a day with your own
scheduler, sending `Authorization: Bearer YOUR_CRON_SECRET`:

```
/api/cron/accrue    mining accrual
/api/cron/risk      anti-fraud rescan
/api/cron/security  access watchdog
/api/cron/payouts   manual payout queue reconciliation
/api/cron/ledger    balance reconciliation and drift alert
```

## 10. CryptAPI setup

CryptAPI needs no account, API key, or KYC. Add at least one public receiving
address in **Admin > Settings > Payments** (or use these environment overrides):

```
CRYPTAPI_BTC_ADDRESS=...
CRYPTAPI_LTC_ADDRESS=...
CRYPTAPI_DOGE_ADDRESS=...
CRYPTAPI_ETH_ADDRESS=...
CRYPTAPI_TRX_ADDRESS=...
CRYPTAPI_USDT_TRC20_ADDRESS=...
```

The app creates a unique deposit address per invoice and passes
`https://YOUR-DOMAIN/api/webhooks/cryptapi` as the callback. USDT TRC20 needs a
different receiving address from TRX. Do not put a wallet private key anywhere
in the app. Withdrawals are manual: send from your wallet, then record the txid
in Admin > Withdrawals.

## 11. Go-live checklist

- [ ] `NEXT_PUBLIC_SITE_URL` points at the live domain, not localhost.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and all secrets are set on the host and never committed.
- [ ] `CRON_SECRET` is a long random value.
- [ ] At least one `CRYPTAPI_*_ADDRESS` is set and a test deposit credits a plan.
- [ ] Plans, prices and daily yield match what you intend to pay out.
- [ ] The admin account exists and two-factor auth is enabled on it.
- [ ] At least one withdrawal allowlist address is set for admin payouts.
- [ ] You have a funded external wallet for manual withdrawals.
- [ ] Sentry DSN and `ALERT_WEBHOOK_URL` are set and a test alert arrives.
- [ ] `BACKUP_ENCRYPTION_KEY` is stored in a secret manager and `npm run backup` succeeds.
- [ ] Native Supabase backups or PITR are enabled, or the backup limitation is accepted.
- [ ] Sample FAQ and content are replaced with your own.
- [ ] You have a plain text Terms and Privacy page for your jurisdiction.

## 12. Troubleshooting

**Register fails, or a new account has no plan.**
The signup trigger is missing. Run `002_auth_trigger.sql` and confirm a default
plan exists (`is_default = true`) in the `plans` table.

**Deposits stay on waiting.**
The IPN secret or the IPN URL is wrong, or the callback cannot reach your site.
Check the `ipn_errors` table in Supabase for the recorded reason.

**Balances only move once a day.**
On Vercel the accrual cron runs daily, which is the Hobby plan limit. On paid
plans, or on your own host, run `/api/cron/accrue` more often. The app also
touches the balance on each visit to keep it current between runs.

**Admin pages redirect to login.**
Your account is not an admin, or the session is stale. Run
`npm run make-admin -- you@example.com`, then sign out and back in.

**"Invalid API key" from Supabase on the server.**
`SUPABASE_SERVICE_ROLE_KEY` is missing or was replaced with the anon key. They
are different values on the same settings screen.

**Build fails with a type error about `for..of`.**
Your Node version is too old. Use 20.19 or newer.

## 13. Updating

Replace the source with the new version, keep your `.env.local`, then run:

```
npm install
```

Apply any new files in `supabase/` in order. New migrations only add tables and
columns, so they do not erase existing data.
