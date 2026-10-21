#!/usr/bin/env node
// Replay an encrypted logical backup into a staging or recovered project.
//
//   RESTORE_TARGET_URL=https://... RESTORE_TARGET_SERVICE_KEY=... \
//   RESTORE_CONFIRM=YES npm run backup:restore -- --in backup.json
//
// The input must already be decrypted with `npm run backup:decrypt`.
// This is an app-data restore, not an auth restore. Create matching auth users
// in the target project first, or restore from a native Supabase backup.

import fs from "node:fs";
import path from "node:path";
import { banner, fail, info, loadEnv, ok, ROOT, warn } from "./lib/util.mjs";

const ORDER = [
  "plans",
  "settings",
  "profiles",
  "user_plan_history",
  "transactions_history",
  "user_deposits",
  "user_withdrawal",
  "withdrawal_allowlist",
  "affiliate_history",
  "checkins",
  "balance_ledger",
  "game_bets",
  "game_rounds",
  "crash_rounds",
  "game_seed_reveals",
  "admin_audit",
  "risk_events",
  "chat_messages",
  "support_messages",
];

const env = { ...loadEnv(ROOT), ...process.env };
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const input = arg("--in");
const targetUrl = env.RESTORE_TARGET_URL;
const targetKey = env.RESTORE_TARGET_SERVICE_KEY;

async function insertRows(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await fetch(`${targetUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: targetKey,
        Authorization: `Bearer ${targetKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      throw new Error(`${table}: HTTP ${res.status} ${(await res.text()).slice(0, 400)}`);
    }
  }
}

async function main() {
  banner("Simple Cloud Mining - logical restore");
  if (env.RESTORE_CONFIRM !== "YES") {
    fail("Set RESTORE_CONFIRM=YES after verifying the target project. This writes data.");
    process.exit(1);
  }
  if (!targetUrl || !targetKey) {
    fail("Set RESTORE_TARGET_URL and RESTORE_TARGET_SERVICE_KEY.");
    process.exit(1);
  }
  if (!input || !fs.existsSync(input)) {
    fail("Pass --in <decrypted-backup.json>.");
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
  if (env.ALLOW_SAME_PROJECT !== "YES") {
    const targetRef = targetUrl.replace(/^https?:\/\//i, "").split(".")[0];
    if (targetRef === payload.projectRef) {
      fail("Target looks like the source project. Restore into staging first.");
      process.exit(1);
    }
  }

  const tables = payload.tables ?? {};
  for (const table of ORDER) {
    const rows = tables[table];
    if (!Array.isArray(rows) || rows.length === 0) {
      info(`${table}: nothing to restore`);
      continue;
    }
    await insertRows(table, rows);
    ok(`${table}: restored ${rows.length}`);
  }
  warn("Reset serial sequences and run reconciliation before cutting over. See docs/RESTORE.md.");
}

main().catch((err) => {
  fail(String(err?.message || err));
  process.exit(1);
});
