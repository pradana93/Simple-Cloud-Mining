#!/usr/bin/env node
// Promote (or demote) an account to site admin.
//
//   node scripts/make-admin.mjs you@example.com
//   node scripts/make-admin.mjs miner_name
//   node scripts/make-admin.mjs 9f1c2b3a-.... --revoke
//   node scripts/make-admin.mjs --list
//
// The account must already exist: sign up in the app first, then run this.
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.

import { c, banner, ok, fail, info, loadEnv, ROOT } from "./lib/util.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const revoke = flags.includes("--revoke");
const list = flags.includes("--list");

const env = loadEnv(ROOT);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

function headers(extra = {}) {
  return {
    apikey: service,
    Authorization: `Bearer ${service}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function main() {
  banner("Simple Cloud Mining - admin access");
  if (!url || !service) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    info("Run `npm run setup` first, or fill those two values by hand.");
    process.exit(1);
  }

  if (list) {
    const res = await fetch(`${url}/rest/v1/profiles?is_admin=eq.true&select=username,email,id`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    if (!rows.length) {
      info("No admins yet.");
      return;
    }
    console.log(`\n${c.bold("Admins")}`);
    for (const r of rows) console.log(`  ${r.username}  ${r.email ?? ""}  ${c.dim(r.id)}`);
    return;
  }

  const who = args[0];
  if (!who) {
    console.log(`Usage:
  node scripts/make-admin.mjs <email|username|uuid> [--revoke]
  node scripts/make-admin.mjs --list`);
    process.exit(1);
  }

  let filter;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(who)) {
    filter = `id=eq.${who}`;
  } else if (who.includes("@")) {
    filter = `email=eq.${encodeURIComponent(who)}`;
  } else {
    filter = `username=eq.${encodeURIComponent(who)}`;
  }

  const res = await fetch(`${url}/rest/v1/profiles?${filter}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ is_admin: !revoke }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const rows = await res.json();

  if (!rows.length) {
    fail(`No account matched "${who}".`);
    info("Sign up in the app first, then run this again.");
    process.exit(1);
  }

  for (const r of rows) {
    ok(`${r.username} (${r.email ?? "no email"}) is_admin=${r.is_admin}`);
  }
  if (!revoke) info("Sign out and back in, then open /admin.");
}

main().catch((err) => {
  fail(String(err.message || err));
  process.exit(1);
});
