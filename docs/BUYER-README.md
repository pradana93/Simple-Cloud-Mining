# Simple Cloud Mining - buyer guide

Thanks for buying. This guide says what is in the box, what you need before you
start, and how to get a site running. The full walkthrough is in
`docs/INSTALL.md`.

## What this is

A Next.js 15 application for running a reward-plan site. Members sign up, get a
plan, watch a balance grow, and withdraw. You run the store from an admin area.

Included features:

- Email and password accounts through Supabase Auth, with row level security.
- Plans with a daily yield, a free default plan, and paid upgrades.
- Non-custodial CryptAPI checkout with signed deposit callbacks.
- A member dashboard with balance, plan status, history and a withdraw form.
- Affiliate referrals with a configurable commission.
- Admin area: settings, plans, users, transactions, withdrawals, FAQ, content,
  contact messages, chat, analytics and an audit log.
- Optional two-factor auth and a withdrawal address allowlist.
- Daily check-in bonus, announcement banner, and a first-run walkthrough.
- A provably fair casino with ten games that wager the member balance, each
    carrying a house edge. Animated rounds, verifiable seeds, and a Casino
    control panel for per-game edge, win caps and bet bounds, lifetime-wager
    tiers, a promo window, live hold reporting, owner profit by game, and
    per-game switches. Off by default, switched on in Settings.
- Installable as a phone app (PWA) with a light and dark theme.
- Manual payouts with a reconciliation pass and a payout log.

## What is in the package

| Path | What it holds |
|---|---|
| `app/` | Pages and API routes |
| `components/` | UI components |
| `lib/` | Business logic: plans, money, security, payouts |
| `supabase/` | Database schema and migrations, applied in order |
| `tests/` | Unit tests (run with `npm test`) |
| `scripts/` | The setup wizard, the admin helper, the packager |
| `docs/` | This guide and the installation guide |
| `public/` | Icons, service worker, static files |
| `Dockerfile`, `docker-compose.yml` | Self-host option |
| `.env.example` | Every setting, with comments |

Not included, by design: `node_modules`, build output, and any secret file.

## Before you start

Have these ready:

- Node.js 20.19 or newer.
- A Supabase project (free tier is fine).
- Crypto wallet receiving addresses, for real deposits.
- A host and a domain, when you are ready to go live.

## Quick start

```
npm install
npm run setup
npm run dev
```

Then open http://localhost:3000/register, create your account, and run:

```
npm run make-admin -- you@example.com
```

Sign out and back in, then open http://localhost:3000/admin.

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build, with lint and type checks |
| `npm start` | Run the production build |
| `npm test` | Run the unit tests |
| `npm run setup` | The setup wizard |
| `npm run setup:check` | Verify your `.env.local` |
| `npm run make-admin -- <email>` | Promote an account to admin |
| `npm run bundle` | Build a zip of this project for resale or backup |

## Customizing

- Branding: site name and slogan live in the admin Settings screen. Colors and
  fonts live in `tailwind.config.ts` and `app/globals.css`.
- Plans: edit them in the admin Plans screen, or change the starter rows in
  `supabase/seed.sql` before you run it.
- Copy: the affiliate, payouts, contact and FAQ text are all editable in the
  admin area.

## Support and updates

Keep `RESET-CREDENTIALS.local.txt` if you created it, and never ship it to a
customer. Keep `.env.local` out of version control.

Migrations only add tables and columns, so applying new files in `supabase/`
over your data is safe. Follow the order in `docs/INSTALL.md`.
