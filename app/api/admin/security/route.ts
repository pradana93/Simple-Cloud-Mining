import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-admin";
import { runSecurityProbes } from "@/lib/security-probe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (String(body.action ?? "run") !== "run") {
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  try {
    const results = await runSecurityProbes();
    const failing = results.filter((r) => !r.passed).length;
    return NextResponse.json({
      ok: failing === 0,
      error: failing === 0 ? undefined : `${failing} check(s) failing`,
      message: failing === 0 ? `All ${results.length} checks passed` : `${failing} of ${results.length} checks failing`,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Security probe failed" }, { status: 500 });
  }
}
