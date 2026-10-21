#!/usr/bin/env node
// Decrypt a logical backup for a restore drill.
//
//   npm run backup:decrypt -- --in backups/scm-....json.enc
//   npm run backup:decrypt -- --in <file> --out <file.json>
//
// Without --out this only prints table counts, never row data. Treat the
// decrypted file as production data and delete it after the restore drill.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { banner, fail, info, loadEnv, ok, ROOT, warn } from "./lib/util.mjs";

const env = { ...loadEnv(ROOT), ...process.env };
const secret = env.BACKUP_ENCRYPTION_KEY;
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};

function newestBackup() {
  const dir = env.BACKUP_DIR ? path.resolve(env.BACKUP_DIR) : path.join(ROOT, "backups");
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json.enc"))
    .sort()
    .reverse();
  return files.length ? path.join(dir, files[0]) : null;
}

function decrypt(envelope, passphrase) {
  if (envelope.format !== "scm-backup-v1" || envelope.algorithm !== "aes-256-gcm") {
    throw new Error("Unsupported backup format.");
  }
  const key = crypto.createHash("sha256").update(passphrase).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

function main() {
  banner("Simple Cloud Mining - decrypt logical backup");
  if (!secret || secret.length < 32) {
    fail("Set BACKUP_ENCRYPTION_KEY to decrypt this backup.");
    process.exit(1);
  }
  const input = arg("--in") || newestBackup();
  if (!input || !fs.existsSync(input)) {
    fail("No backup file found. Pass --in <file>.");
    process.exit(1);
  }

  const envelope = JSON.parse(fs.readFileSync(input, "utf8"));
  const payload = decrypt(envelope, secret);
  const tables = payload.tables ?? {};
  let total = 0;
  for (const [name, rows] of Object.entries(tables)) {
    const n = Array.isArray(rows) ? rows.length : 0;
    total += n;
    info(`${name}: ${n}`);
  }
  ok(`Decrypted ${input} (${total} rows, created ${payload.createdAt}).`);

  const out = arg("--out");
  if (out) {
    const target = path.resolve(out);
    fs.writeFileSync(target, JSON.stringify(payload, null, 2), { mode: 0o600 });
    warn(`Plaintext written to ${target}. Delete it after the drill.`);
  } else {
    info("No --out given, so no row data was written.");
  }
}

try {
  main();
} catch (err) {
  fail(String(err?.message || err));
  process.exit(1);
}
