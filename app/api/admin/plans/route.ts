import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";
import { earningRateFromDaily, planNetEconomics } from "@/lib/plan-math";
import { getSettings } from "@/lib/settings";
import { getFxTable } from "@/lib/fx";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Parsed = {
  errors: Record<string, string>;
  value: {
    plan_name: string;
    version: string | null;
    image: string;
    speed: string;
    profit: string | null;
    price: number;
    duration: number;
    point_per_day: number;
    is_default: boolean;
    earning_rate: number;
  };
};

function parsePlan(body: Record<string, unknown>): Parsed {
  const errors: Record<string, string> = {};
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

  const plan_name = str(body.plan_name, 50);
  if (!plan_name) errors.plan_name = "Plan name is required";

  const price = Number(body.price ?? 0);
  if (!Number.isFinite(price) || price < 0) errors.price = "Price must be zero or more";

  const duration = Math.round(Number(body.duration ?? 0));
  if (!Number.isFinite(duration) || duration < 1) errors.duration = "Duration must be at least 1 day";

  const daily = body.point_per_day === "" || body.point_per_day == null ? 0 : Number(body.point_per_day);
  if (!Number.isFinite(daily) || daily < 0) errors.point_per_day = "Daily yield must be zero or more";

  return {
    errors,
    value: {
      plan_name,
      version: str(body.version, 30) || null,
      image: str(body.image, 100) || "1.png",
      speed: str(body.speed, 191) || "1",
      profit: str(body.profit, 191) || null,
      price,
      duration,
      point_per_day: daily,
      is_default: body.is_default === true || body.is_default === "true",
      earning_rate: earningRateFromDaily(daily),
    },
  };
}

async function validateEconomics(value: Parsed["value"]): Promise<{ error: string; status: number } | null> {
  if (value.price <= 0) return null;
  if (value.is_default) {
    return { error: "Only a free plan can be the default starter plan.", status: 422 };
  }
  const settings = await getSettings();
  const priceCurrency = settings.price_currency.toUpperCase();
  let cryptoToPrice = 1;
  if (priceCurrency !== settings.currency_code.toUpperCase()) {
    const table = await getFxTable(settings.currency_code);
    cryptoToPrice = table?.rates[priceCurrency] ?? 0;
  }
  if (!(cryptoToPrice > 0)) {
    return { error: "Live DOGE rate is unavailable. Try again before saving a paid plan.", status: 503 };
  }
  const net = planNetEconomics({
    price: value.price,
    point_per_day: value.point_per_day,
    duration: value.duration,
    cryptoToPrice,
    processorPct: 0.25,
    affiliatePct: Number(settings.aff_comission) || 0,
  });
  if (net.netProfit <= 0) {
    return {
      error: `This plan loses money after fees and affiliate commission (${net.netMarginPct.toFixed(1)}% margin). Lower the daily credit or raise the price.`,
      status: 422,
    };
  }
  return null;
}

async function clearOtherDefaults(id: number | null) {
  const admin = createAdminSupabase();
  const q = admin.from("plans").update({ is_default: false }).eq("is_default", true);
  if (id != null) await q.neq("id", id);
  else await q;
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { errors, value } = parsePlan(body);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, error: "Check the highlighted fields", errors }, { status: 422 });
  const econError = await validateEconomics(value);
  if (econError) {
    return NextResponse.json({ ok: false, error: econError.error }, { status: econError.status });
  }

  try {
    const admin = createAdminSupabase();
    const { data, error } = await admin.from("plans").insert(value).select("id").maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    const id = (data as { id: number } | null)?.id ?? null;
    if (value.is_default && id != null) await clearOtherDefaults(id);
    revalidateTag("plans");
    await recordAudit({ actor: { id: gate.userId, name: gate.name }, action: "plan.create", target: value.plan_name, detail: { id }, req });
    return NextResponse.json({ ok: true, id, message: "Plan created" });
  } catch {
    return NextResponse.json({ ok: false, error: "Create failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Plan id is required" }, { status: 400 });

  const { errors, value } = parsePlan(body);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, error: "Check the highlighted fields", errors }, { status: 422 });
  const econError = await validateEconomics(value);
  if (econError) {
    return NextResponse.json({ ok: false, error: econError.error }, { status: econError.status });
  }

  try {
    const admin = createAdminSupabase();
    const { error } = await admin.from("plans").update(value).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    if (value.is_default) await clearOtherDefaults(id);
    revalidateTag("plans");
    await recordAudit({ actor: { id: gate.userId, name: gate.name }, action: "plan.update", target: value.plan_name, detail: { id }, req });
    return NextResponse.json({ ok: true, message: "Plan updated" });
  } catch {
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  let body: { id?: unknown };
  try {
    body = (await req.json()) as { id?: unknown };
  } catch {
    body = {};
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Plan id is required" }, { status: 400 });

  try {
    const admin = createAdminSupabase();
    const { count } = await admin
      .from("user_plan_history")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", id);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { ok: false, error: `Plan is used by ${count} rig${count === 1 ? "" : "s"}. Revoke those first.` },
        { status: 409 }
      );
    }
    const { error } = await admin.from("plans").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    revalidateTag("plans");
    await recordAudit({ actor: { id: gate.userId, name: gate.name }, action: "plan.delete", target: String(id), req });
    return NextResponse.json({ ok: true, message: "Plan removed" });
  } catch {
    return NextResponse.json({ ok: false, error: "Delete failed" }, { status: 500 });
  }
}
