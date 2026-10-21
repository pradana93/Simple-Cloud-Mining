#!/usr/bin/env node
// Export the application tables to one encrypted JSON file.
//
//   npm run backup
//
// Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// BACKUP_ENCRYPTION_KEY from .env.local. The output is AES-256-GCM encrypted;
// this script refuses to write an unencrypted backup.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { banner, fail, info, loadEnv, ok, projectRefFromUrl, ROOT, warn } from "./lib/util.mjs";
import { backupPageUrl } from "./lib/backup-page.mjs";

const TABLES = [
  "profiles",
  "plans",
  "settings",
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
  "game_seeds",
  "game_seed_reveals",
  "payout_events",
  "ipn_errors",
  "user_2fa",
  "login_attempts",
  "security_checks",
  "account_risk",
  "admin_audit",
  "risk_events",
  "chat_messages",
  "support_messages",
];

const env = { ...loadEnv(ROOT), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const secret = env.BACKUP_ENCRYPTION_KEY;
const pageSize = 1000;

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function authHeaders() {
  return {
    apikey: service,
    Authorization: `Bearer ${service}`,
  };
}

async function fetchTable(table) {
  const rows = [];
  let afterId = null;
  for (;;) {
    const res = await fetch(backupPageUrl(url, table, afterId, pageSize), {
      headers: authHeaders(),
    });
    if (res.status === 404) return { rows, missing: true };
    if (!res.ok) {
      throw new Error(`${table}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length === 0) break;
    const last = page[page.length - 1];
    if (!last || last.id == null) {
      throw new Error(`${table}: page has no id cursor`);
    }
    afterId = String(last.id);
  }
  return { rows, missing: false };
}

function encrypt(payload, passphrase) {
  const key = crypto.createHash("sha256").update(passphrase).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(payload), "utf8")), cipher.final()]);
  return {
    format: "scm-backup-v1",
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

async function main() {
  banner("Simple Cloud Mining - encrypted logical backup");
  if (!url || !service) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    process.exit(1);
  }
  if (!secret || secret.length < 32) {
    fail("Set BACKUP_ENCRYPTION_KEY to at least 32 characters. Plain backups are not allowed.");
    process.exit(1);
  }

  const tables = {};
  for (const table of TABLES) {
    const { rows, missing } = await fetchTable(table);
    tables[table] = rows;
    if (missing) warn(`${table}: table not found, skipped`);
    else ok(`${table}: ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  }

  const payload = {
    format: "scm-backup-v1",
    createdAt: new Date().toISOString(),
    projectRef: projectRefFromUrl(url),
    tables,
  };
  const envelope = encrypt(payload, secret);
  const dir = env.BACKUP_DIR ? path.resolve(env.BACKUP_DIR) : path.join(ROOT, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `scm-${stamp()}.json.enc`);
  fs.writeFileSync(file, JSON.stringify(envelope), { mode: 0o600 });
  const size = fs.statSync(file).size;
  info(`Wrote ${file} (${Math.round(size / 1024)} KiB).`);

  if (env.BACKUP_UPLOAD_URL) {
    const headers = { "content-type": "application/octet-stream" };
    if (env.BACKUP_UPLOAD_TOKEN) headers.authorization = `Bearer ${env.BACKUP_UPLOAD_TOKEN}`;
    const res = await fetch(env.BACKUP_UPLOAD_URL, {
      method: "PUT",
      headers,
      body: fs.readFileSync(file),
    });
    if (!res.ok) {
      warn(`Offsite upload failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    } else {
      ok("Encrypted backup uploaded offsite");
    }
  } else {
    info("Set BACKUP_UPLOAD_URL (and optional BACKUP_UPLOAD_TOKEN) to copy backups offsite.");
  }

  info("Store this file off the server and keep BACKUP_ENCRYPTION_KEY in a separate secret manager.");
}

main().catch((err) => {
  fail(String(err?.message || err));
  process.exit(1);
});
