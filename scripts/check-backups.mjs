#!/usr/bin/env node
// Report the Supabase backup posture for this project.
//
//   npm run backup:check
//
// Needs SUPABASE_ACCESS_TOKEN (a personal access token) and
// NEXT_PUBLIC_SUPABASE_URL in .env.local. Exits non-zero when the project has
// neither point-in-time recovery nor a stored backup.

import { banner, fail, info, loadEnv, ok, projectRefFromUrl, ROOT, warn } from "./lib/util.mjs";

const env = { ...loadEnv(ROOT), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF || (url ? projectRefFromUrl(url) : null);

async function main() {
  banner("Simple Cloud Mining - backup posture");
  if (!ref || !token) {
    fail("Missing SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_ACCESS_TOKEN.");
    process.exit(1);
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/backups`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const body = await res.json();
  const pitr = Boolean(body.pitr_enabled ?? body.pitr?.enabled);
  const backups = Array.isArray(body.backups) ? body.backups : [];

  console.log(`  project: ${ref}`);
  info(`point-in-time recovery: ${pitr ? "enabled" : "disabled"}`);
  info(`stored backups: ${backups.length}`);

  for (const b of backups.slice(0, 10)) {
    const when = b.inserted_at || b.created_at || b.timestamp || "unknown time";
    const status = b.status || "unknown";
    console.log(`    - ${when}  ${status}`);
  }

  if (!pitr && backups.length === 0) {
    warn("No PITR and no stored backups. Take an encrypted logical backup and enable native backups before production.");
    process.exit(1);
  }
  ok("Native backup coverage is present.");
}

main().catch((err) => {
  fail(String(err?.message || err));
  process.exit(1);
});
