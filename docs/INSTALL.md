# Installation guide

Simple Cloud Mining is a Next.js 14 web app. It uses Supabase for the database
and login, and CoinPayments to take deposits. This guide takes you from the
downloaded folder to a running site, then to a live deploy.

Read time is about 15 minutes. The database and deploy steps are the only parts
that need careful attention.

## 1. What you need

| Item | Notes |
|---|---|
| Node.js 18.17 or newer | https://nodejs.org. The installer checks this. |
| A Supabase account | Free tier is enough to start. https://supabase.com |
| A CoinPayments account | Needed for real deposits. https://www.coinpayments.net |
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
4. **CoinPayments.** Your merchant ID and IPN secret. The API keys are optional
   and only needed for automated payouts.

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
| 15 | `seed.sql` | Starter plans, settings and sample content |

Order matters. Files 2 through 14 assume the tables from `schema.sql`, and
`006_security_lockdown.sql` assumes the functions from `005`.

## 6. Environment variables

Set these in `.env.local` for local work and in your host's dashboard for
deploys. `.env.example` lists them with comments.

| Variable | Required | Where to find it | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase Project Settings > API | Database and auth endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same screen | Public key, safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Same screen | Server key that bypasses row level security |
| `NEXT_PUBLIC_SITE_URL` | Yes | You choose it | Absolute URL for referrals and payment redirects |
| `CRON_SECRET` | Yes | You generate it | Guards the `/api/cron/*` routes |
| `COINPAYMENTS_MERCHANT_ID` | Yes | CoinPayments Account > API Keys | Identifies your store at checkout |
| `COINPAYMENTS_IPN_SECRET` | Yes | Same screen | Verifies incoming payment callbacks |
| `COINPAYMENTS_PRIVATE_KEY` | No | Same screen | API mode checkout and automated payouts |
| `COINPAYMENTS_PUBLIC_KEY` | No | Same screen | Same as above |
| `RISK_SALT` | No | You generate it | Salt for hashing IPs in anti-fraud data |
| `SMTP_SENDER` | No | Your mail provider | From address on gateway emails |
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
| Withdrawals | Review requests, run the payout pass, see the audit trail |
| Analytics | Revenue, signups and conversion |
| Audit log | Who changed what, and when |

Two features are off until you enable them in Settings: the announcement banner
and the daily check-in bonus. Automated payouts also stay off until you enable
them there and add the CoinPayments API keys. The casino is off by default too:
turn on **Casino** in Settings and set a minimum and maximum bet before members
can play.

## 9. Deploy

### Vercel

1. Push this folder to a Git repository you own.
2. Import the repository at https://vercel.com/new.
3. Add every variable from section 6 in Project Settings > Environment
   Variables. Use your live domain for `NEXT_PUBLIC_SITE_URL`.
4. Deploy.

`vercel.json` already declares the four scheduled jobs. Vercel calls them with
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
themselves outside Vercel, so call these four URLs once a day with your own
scheduler, sending `Authorization: Bearer YOUR_CRON_SECRET`:

```
/api/cron/accrue    mining accrual
/api/cron/risk      anti-fraud rescan
/api/cron/security  access watchdog
/api/cron/payouts   automated payout pass
```

## 10. CoinPayments setup

In the CoinPayments dashboard, set the IPN URL to:

```
https://YOUR-DOMAIN/api/ipn/coinpayments
```

Without this, deposits are recorded as waiting and plans never activate. The
app verifies each callback against `COINPAYMENTS_IPN_SECRET`.

## 11. Go-live checklist

- [ ] `NEXT_PUBLIC_SITE_URL` points at the live domain, not localhost.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and all API keys are set on the host and never committed.
- [ ] `CRON_SECRET` is a long random value.
- [ ] The IPN URL in CoinPayments matches your domain.
- [ ] Plans, prices and daily yield match what you intend to pay out.
- [ ] The admin account exists and two-factor auth is enabled on it.
- [ ] At least one withdrawal allowlist address is set for admin payouts.
- [ ] You have decided whether automated payouts are on, and set the ceiling.
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
Your Node version is too old. Use 18.17 or newer.

## 13. Updating

Replace the source with the new version, keep your `.env.local`, then run:

```
npm install
```

Apply any new files in `supabase/` in order. New migrations only add tables and
columns, so they do not erase existing data.
