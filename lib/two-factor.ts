import { createAdminSupabase } from "./supabase/admin";
import { generateRecoveryCodes, hashRecoveryCode, verifyTotp } from "./totp";

export type RecoveryEntry = { h: string; used: boolean };

export type TwoFactor = {
  secret: string;
  enabled: boolean;
  last_step: number | null;
  recovery: RecoveryEntry[];
};

export async function getTwoFactor(userId: string): Promise<TwoFactor | null> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("user_2fa")
    .select("secret,enabled,last_step,recovery")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as (TwoFactor & { recovery: RecoveryEntry[] | null }) | null;
  if (!row) return null;
  return { ...row, recovery: (row.recovery ?? []) as RecoveryEntry[] };
}

export async function isTwoFactorEnabled(userId: string): Promise<boolean> {
  const row = await getTwoFactor(userId);
  return Boolean(row?.enabled && row.secret);
}

export type VerifyResult = { ok: boolean; usedRecovery: boolean };

// Checks a 6-digit code against the enrolled secret, then a recovery code.
// A TOTP step is recorded so the same code cannot be replayed.
export async function verifyUserCode(userId: string, code: string): Promise<VerifyResult> {
  const row = await getTwoFactor(userId);
  if (!row?.enabled) return { ok: false, usedRecovery: false };

  const admin = createAdminSupabase();
  const step = verifyTotp(row.secret, code, { window: 1 });
  if (step != null && (row.last_step == null || step > row.last_step)) {
    await admin.from("user_2fa").update({ last_step: step, updated_at: new Date().toISOString() }).eq("user_id", userId);
    return { ok: true, usedRecovery: false };
  }

  const hash = hashRecoveryCode(code);
  const idx = row.recovery.findIndex((r) => !r.used && r.h === hash);
  if (idx >= 0) {
    const recovery = row.recovery.map((r, i) => (i === idx ? { ...r, used: true } : r));
    await admin.from("user_2fa").update({ recovery, updated_at: new Date().toISOString() }).eq("user_id", userId);
    return { ok: true, usedRecovery: true };
  }

  return { ok: false, usedRecovery: false };
}

export function buildRecovery(plain: string[]): RecoveryEntry[] {
  return plain.map((code) => ({ h: hashRecoveryCode(code), used: false }));
}

export function newRecoveryCodes(count = 8): { plain: string[]; stored: RecoveryEntry[] } {
  const plain = generateRecoveryCodes(count);
  return { plain, stored: buildRecovery(plain) };
}
