#!/usr/bin/env node
// Interactive setup for Simple Cloud Mining.
//
//   node scripts/install.mjs            full wizard (env + database)
//   node scripts/install.mjs --skip-db  env only, keep your existing database
//   node scripts/install.mjs --check    validate the current .env.local
//   node scripts/install.mjs --help
//
// Runs on Node builtins only, so it works before `npm install`.

import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  c,
  banner,
  step,
  ok,
  info,
  warn,
  fail,
  randomHex,
  loadEnv,
  parseEnv,
  writeEnvFile,
  orderSqlFiles,
  readSql,
  projectRefFromUrl,
  restCheck,
  runSql,
  scaffoldCheck,
  Prompt,
} from "./lib/util.mjs";

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);

if (has("--help") || has("-h")) {
  console.log(`Simple Cloud Mining setup

  node scripts/install.mjs            Run the full wizard (env + database schema)
  node scripts/install.mjs --skip-db  Write .env.local only
  node scripts/install.mjs --check    Validate the current .env.local

The wizard asks for your Supabase keys, applies the SQL in supabase/ in order,
writes .env.local, then prints the remaining steps. Read docs/INSTALL.md for the
full guide.`);
  process.exit(0);
}

const MODE = has("--check") ? "check" : has("--skip-db") ? "env" : "full";
const prompt = new Prompt();

function isUrl(v) {
  return /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(v);
}
function isJwt(v) {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v);
}

function nodeOk() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 20 || (major === 20 && minor >= 19);
}

async function collectSupabase(existing) {
  step(1, 4, "Supabase project");
  info("Create a project at https://supabase.com, then open Project Settings > API.");
  info("Press Enter on a prompt to keep the value already in .env.local.");

  const url = await prompt.required(
    "Project URL",
    (v) => (isUrl(v) ? null : "Expected something like https://abcdefgh.supabase.co"),
    { def: existing.NEXT_PUBLIC_SUPABASE_URL || "" }
  );
  const anon = await prompt.required(
    "Anon (public) key",
    (v) => (v.length > 20 ? null : "That key looks too short."),
    { def: existing.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" }
  );
  const service = await prompt.required(
    "Service role key (server only)",
    (v) =>
      v.length > 20
        ? null
        : "That key looks too short. Do not paste the anon key here.",
    { def: existing.SUPABASE_SERVICE_ROLE_KEY || "" }
  );

  process.stdout.write("  Checking credentials... ");
  let reach;
  try {
    reach = await restCheck(url, anon, "settings");
  } catch (err) {
    process.stdout.write(c.red("failed") + "\n");
    fail(String(err.message || err));
    throw new Error("Could not reach the project REST endpoint. Check the URL and keys.");
  }
  process.stdout.write(c.green("reachable") + "\n");
  if (reach.missingTable) {
    warn("The database tables are not there yet. The wizard can create them now.");
  } else if (reach.ok) {
    ok("Schema already present (you can skip the database step).");
  }
  return { url, anon, service };
}

async function applyDatabase(url, existing) {
  step(2, 4, "Database schema");
  const files = orderSqlFiles(path.join(ROOT, "supabase"));
  info(`${files.length} SQL files will run in this order:`);
  console.log("      " + c.dim(files.join(", ")));

  if (MODE === "env" || !(await prompt.confirm("Apply them to your project now?", true))) {
    warn("Skipped. Run supabase/schema.sql, then the numbered files, then seed.sql by hand.");
    info("See docs/INSTALL.md, section 'Manual database setup'.");
    return;
  }

  const ref = projectRefFromUrl(url);
  info("The wizard needs a Supabase personal access token to run SQL.");
  info("Create one at https://supabase.com/dashboard/account/tokens");
  const pat = await prompt.required("Personal access token (starts with sbp_)", null, {
    hidden: true,
    def: existing.SUPABASE_ACCESS_TOKEN || "",
  });

  process.stdout.write("  Verifying token... ");
  try {
    await runSql(pat, ref, "select 1;");
    process.stdout.write(c.green("ok") + "\n");
  } catch (err) {
    process.stdout.write(c.red("failed") + "\n");
    fail(String(err.message || err));
    throw new Error("The token or project ref was rejected by the Supabase API.");
  }

  let applied = 0;
  let failed = null;
  for (const file of files) {
    process.stdout.write(`  ${file} ... `);
    try {
      await runSql(pat, ref, readSql(file));
      applied++;
      process.stdout.write(c.green("ok") + "\n");
    } catch (err) {
      process.stdout.write(c.red("failed") + "\n");
      fail(String(err.message || err));
      failed = file;
      const go = await prompt.confirm("Keep going with the remaining files?", false);
      if (!go) break;
    }
  }

  info(`${applied}/${files.length} files applied.`);
  if (!failed) {
    process.stdout.write("  Verifying settings row... ");
    const count = await scaffoldCheck(pat, ref);
    if (count && count > 0) {
      process.stdout.write(c.green(`${count} row`) + "\n");
      ok("Database is seeded.");
    } else {
      process.stdout.write(c.yellow("no rows") + "\n");
      warn("The settings row is missing. Re-run supabase/seed.sql in the SQL editor.");
    }
  }
  return { applied, failed };
}

async function collectApp(existing) {
  step(3, 4, "Site and automation");
  const site = await prompt.required(
    "Site URL",
    (v) => (/^https?:\/\/.+/.test(v) ? null : "Include the scheme, e.g. https://miner.example.com"),
    { def: existing.NEXT_PUBLIC_SITE_URL || "http://localhost:3000" }
  );

  let cron = existing.CRON_SECRET || "";
  if (!cron && (await prompt.confirm("Generate a strong CRON_SECRET for you?", true))) {
    cron = randomHex(32);
    ok("Generated.");
  } else if (!cron) {
    cron = await prompt.required("CRON_SECRET", null, { hidden: true });
  } else {
    info("Reusing the existing CRON_SECRET.");
  }
  return { site, cron };
}

async function collectPayments(existing) {
  step(4, 4, "CoinPayments");
  info("Create an account at https://www.coinpayments.net and open Account > API Keys.");
  info("Leave the API keys blank if you only plan to use the hosted Gateway checkout.");

  const merchant = await prompt.required(
    "Merchant ID",
    null,
    { def: existing.COINPAYMENTS_MERCHANT_ID || "" }
  );
  const ipn = await prompt.required(
    "IPN secret",
    null,
    { hidden: true, def: existing.COINPAYMENTS_IPN_SECRET || "" }
  );

  let priv = existing.COINPAYMENTS_PRIVATE_KEY || "";
  let pub = existing.COINPAYMENTS_PUBLIC_KEY || "";
  if (await prompt.confirm("Add API keys (needed for auto payouts)?", false)) {
    priv = await prompt.required("API private key", null, { hidden: true, def: priv });
    pub = await prompt.required("API public key", null, { hidden: true, def: pub });
  }

  let smtp = existing.SMTP_SENDER || "";
  if (await prompt.confirm("Set a from address for gateway emails (optional)?", false)) {
    smtp = await prompt.text("From email", { def: smtp });
  }

  let openai = existing.OPENAI_API_KEY || "";
  let anthropic = existing.ANTHROPIC_API_KEY || "";
  if (await prompt.confirm("Add an AI key for the admin plan assistant (optional)?", false)) {
    const provider = await prompt.choice("Which provider?", ["OpenAI", "Anthropic"], 0);
    if (provider === 0) openai = await prompt.required("OpenAI API key", null, { hidden: true, def: openai });
    else anthropic = await prompt.required("Anthropic API key", null, { hidden: true, def: anthropic });
  }

  return { merchant, ipn, priv, pub, smtp, openai, anthropic };
}

function printGuide(pairs) {
  const has = new Map(pairs);
  banner("Setup complete");
  console.log(`${c.bold(".env.local")} was written to:
  ${info(path.join(ROOT, ".env.local"))}

${c.bold("Next steps")}

  1. Install dependencies and start the dev server:
       ${c.cyan("npm install")}
       ${c.cyan("npm run dev")}
     Open http://localhost:3000.

  2. Create your admin account:
       Open ${c.cyan("http://localhost:3000/register")} and sign up.
       Then promote that account:
       ${c.cyan("npm run make-admin -- you@example.com")}

  3. Visit /admin and set up your store:
       Settings  ->  site name, currency, min/max withdrawal, withdrawal review
       Plans     ->  prices and daily yield per plan
       Content   ->  affiliate, payouts and contact copy
       FAQ       ->  replace the sample questions

  4. Deploy for real users (see docs/INSTALL.md "Deploy"):
       Push the repo to GitHub, import it in Vercel, add the same env vars,
       and set the CoinPayments IPN URL to https://YOUR-DOMAIN/api/ipn/coinpayments

${c.bold("Before you take real money")}
  - Set NEXT_PUBLIC_SITE_URL to your live domain in the host's env vars.
  - CoinPayments merchant: ${has.get("COINPAYMENTS_MERCHANT_ID") ? "set" : c.red("missing")}
  - IPN secret: ${has.get("COINPAYMENTS_IPN_SECRET") ? "set" : c.red("missing")}
  - Cron secret: ${has.get("CRON_SECRET") ? "set" : c.red("missing")}
  - Enable two-factor auth and a withdrawal allowlist for admin actions.
  - Keep .env.local and RESET-CREDENTIALS.local.txt out of version control.

The full guide lives in ${c.bold("docs/INSTALL.md")}.`);
}

async function main() {
  banner("Simple Cloud Mining - setup");
  if (!nodeOk()) {
    fail(`Node 20.19 or newer is required. You have ${process.versions.node}.`);
    process.exit(1);
  }

  const existing = loadEnv(ROOT);
  if (fs.existsSync(path.join(ROOT, ".env.local"))) {
    warn("Found an existing .env.local. Your current values are offered as defaults.");
  }

  if (MODE === "check") {
    const have = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "CRON_SECRET",
      "COINPAYMENTS_MERCHANT_ID",
      "COINPAYMENTS_IPN_SECRET",
    ];
    let bad = 0;
    for (const key of have) {
      if (existing[key]) ok(key);
      else {
        fail(`${key} is missing`);
        bad++;
      }
    }
    if (existing.NEXT_PUBLIC_SUPABASE_URL && existing.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const r = await restCheck(existing.NEXT_PUBLIC_SUPABASE_URL, existing.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        if (r.ok) ok("Supabase REST reachable");
        else if (r.missingTable) warn("REST reachable, but the schema is not applied");
        else fail("Supabase REST rejected the anon key");
      } catch (err) {
        fail(String(err.message || err));
      }
    }
    process.exit(bad ? 1 : 0);
  }

  const supa = await collectSupabase(existing);
  let db = { applied: 0, failed: null };
  if (MODE === "full") {
    db = await applyDatabase(supa.url, existing);
  } else {
    step(2, 4, "Database schema");
    info("Skipped (--skip-db).");
  }
  const app = await collectApp(existing);
  const pay = await collectPayments(existing);

  const pairs = [
    ["NEXT_PUBLIC_SUPABASE_URL", supa.url],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", supa.anon],
    ["SUPABASE_SERVICE_ROLE_KEY", supa.service],
    ["NEXT_PUBLIC_SITE_URL", app.site],
    ["CRON_SECRET", app.cron],
    ["COINPAYMENTS_MERCHANT_ID", pay.merchant],
    ["COINPAYMENTS_IPN_SECRET", pay.ipn],
  ];
  if (pay.priv) pairs.push(["COINPAYMENTS_PRIVATE_KEY", pay.priv]);
  if (pay.pub) pairs.push(["COINPAYMENTS_PUBLIC_KEY", pay.pub]);
  if (pay.smtp) pairs.push(["SMTP_SENDER", pay.smtp]);
  pairs.push(["RISK_SALT", existing.RISK_SALT || randomHex(24)]);
  if (pay.openai) pairs.push(["OPENAI_API_KEY", pay.openai]);
  if (pay.anthropic) pairs.push(["ANTHROPIC_API_KEY", pay.anthropic]);

  const { target, backup } = writeEnvFile(pairs, ROOT);
  if (backup) info(`Previous file backed up to ${path.basename(backup)}`);
  ok(`Wrote ${path.relative(ROOT, target)}`);
  if (db.failed) warn(`Note: ${db.failed} failed during the database step. Re-run it from the SQL editor.`);

  printGuide(pairs);
}

main()
  .catch((err) => {
    console.error("\n" + c.red("Setup stopped: ") + (err?.message || err));
    console.error(c.dim("Fix the problem above and run `npm run setup` again."));
    process.exit(1);
  })
  .finally(() => prompt.close());
