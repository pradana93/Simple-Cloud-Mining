import { NextResponse } from "next/server";
import { hasFreshMfa } from "./mfa-cookie";
import { isTwoFactorEnabled } from "./two-factor";

// Gate for sensitive actions. Members without 2FA are never challenged, so the
// feature stays opt-in; enrolled members must present a fresh code.
export async function requireFreshMfa(userId: string): Promise<NextResponse | null> {
  if (!(await isTwoFactorEnabled(userId))) return null;
  if (hasFreshMfa(userId)) return null;
  return NextResponse.json(
    { ok: false, error: "Confirm your authenticator code to continue.", mfaRequired: true },
    { status: 403 }
  );
}
