#!/usr/bin/env node
// Build a customer-ready zip of the app.
//
//   node scripts/package.mjs
//
// Output: dist/simple-cloud-mining-v<version>.zip
//
// Ships the source, SQL, docs, installer and license. Leaves out anything
// private or rebuildable: node_modules, .next, .git, .env.local, reset
// credential dumps and the internal design notes. The ZIP is written with no
// third-party dependency.

import fs from "node:fs";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { ROOT, c, banner, ok, info, warn, fail } from "./lib/util.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const VERSION = pkg.version || "0.0.0";
const STAGE = `simple-cloud-mining-v${VERSION}`;
const OUT_DIR = path.join(ROOT, "dist");
const ZIP_PATH = path.join(OUT_DIR, `${STAGE}.zip`);

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  "dist",
  "coverage",
  ".turbo",
  "anti-slop",
]);

function isExcluded(rel) {
  const parts = rel.split("/");
  if (parts.some((p) => EXCLUDE_DIRS.has(p))) return true;
  if (rel.startsWith("supabase/.temp")) return true;
  const base = parts[parts.length - 1];
  if (base === ".env" || base === ".env.local") return true;
  if (/^\.env\..+\.local$/.test(base)) return true;
  if (base === "RESET-CREDENTIALS.local.txt") return true;
  if (base === "tsconfig.tsbuildinfo" || base === "next-env.d.ts") return true;
  if (base === "DESIGN.md") return true;
  if (/\.local\.json$/.test(base)) return true;
  if (/\.bak\./.test(base)) return true;
  return false;
}

function walk(dir, rel = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (isExcluded(relPath)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, relPath));
    else if (entry.isFile()) out.push({ rel: relPath, abs });
  }
  return out;
}

// --- minimal zip writer ------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let cch = n;
    for (let k = 0; k < 8; k++) cch = cch & 1 ? 0xedb88320 ^ (cch >>> 1) : cch >>> 1;
    t[n] = cch >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosStamp(d) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

function buildZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  const stamp = dosStamp(new Date());

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const deflated = deflateRawSync(data);
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(stamp.time, 12);
    cd.writeUInt16LE(stamp.date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, centralBuf, end]);
}

// --- build -------------------------------------------------------------------

function startHere() {
  return `Simple Cloud Mining v${VERSION}
=====================================

Thanks for your purchase. Everything you need is in this folder.

Read this first:
  docs/INSTALL.md      full installation and deployment guide
  docs/BUYER-README.md what is included, accounts you need, and requirements

Fastest path:
  1. Install Node.js 20.19 or newer.
  2. Open a terminal in this folder and run:  npm install
  3. Run the setup wizard:                     npm run setup
  4. Start the app:                            npm run dev
  5. Sign up at http://localhost:3000/register
  6. Promote your account:                     npm run make-admin -- you@example.com

Questions about what you are allowed to do with this code are answered in
LICENSE.txt.
`;
}

function main() {
  banner(`Packaging ${STAGE}`);
  if (!fs.existsSync(path.join(ROOT, "docs", "INSTALL.md"))) {
    warn("docs/INSTALL.md is missing. The package will ship without the guide.");
  }

  const files = walk(ROOT);
  const entries = [];

  entries.push({
    name: `${STAGE}/START-HERE.txt`,
    data: Buffer.from(startHere(), "utf8"),
  });

  for (const f of files) {
    entries.push({
      name: `${STAGE}/${f.rel}`,
      data: fs.readFileSync(f.abs),
    });
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const zip = buildZip(entries);
  fs.writeFileSync(ZIP_PATH, zip);

  const mb = (zip.length / (1024 * 1024)).toFixed(2);
  ok(`${entries.length} files, ${mb} MB`);
  info(path.relative(ROOT, ZIP_PATH));
  console.log(`\n${c.bold("Ship it:")} upload the zip to your store or hand it to the buyer.`);
  console.log(c.dim("It contains no .env.local, no node_modules and no build output."));
}

try {
  main();
} catch (err) {
  fail(String(err?.message || err));
  process.exit(1);
}
