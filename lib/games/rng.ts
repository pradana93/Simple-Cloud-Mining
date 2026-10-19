// Provably fair random stream.
//
// The house generates a secret server seed and publishes only its SHA-256 hash
// before play. The member picks a client seed. Each bet consumes the next nonce.
// The outcome floats are HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`)
// read four bytes at a time, so a member can recompute every past bet once the
// server seed is revealed on rotation.

import crypto from "crypto";

export function hashServerSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

export function randomServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function floatStream(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  count: number
): number[] {
  const out: number[] = [];
  let cursor = 0;
  while (out.length < count) {
    const block = crypto
      .createHmac("sha256", serverSeed)
      .update(`${clientSeed}:${nonce}:${cursor}`)
      .digest();
    for (let i = 0; i < 8 && out.length < count; i++) {
      out.push(block.readUInt32BE(i * 4) / 0x100000000);
    }
    cursor++;
  }
  return out;
}
