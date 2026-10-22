import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { getFxTable } from "@/lib/fx";
import { PlansManager, type AdminPlan } from "@/components/admin/plans-manager";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const admin = createAdminSupabase();
    const [plansRes, usageRes] = await Promise.all([
      admin
        .from("plans")
        .select("id,plan_name,version,image,price,point_per_day,duration,profit,speed,is_default")
        .order("price"),
      admin.from("user_plan_history").select("plan_id"),
    ]);
    const plans = ((plansRes.data ?? []) as AdminPlan[]).map((p) => ({ ...p, speed: String(p.speed ?? "") }));
    const usage: Record<number, number> = {};
    for (const row of (usageRes.data ?? []) as Array<{ plan_id: number }>) {
      usage[row.plan_id] = (usage[row.plan_id] ?? 0) + 1;
    }
    return { plans, usage };
  } catch {
    return { plans: [] as AdminPlan[], usage: {} as Record<number, number> };
  }
}

export default async function AdminPlans() {
  const [{ plans, usage }, settings] = await Promise.all([load(), getSettings()]);
  const priceCurrency = settings.price_currency.toUpperCase();
  let cryptoToPrice = 1;
  if (priceCurrency !== settings.currency_code.toUpperCase()) {
    const table = await getFxTable(settings.currency_code);
    cryptoToPrice = table?.rates[priceCurrency] ?? 0;
  }
  return (
    <PlansManager
      plans={plans}
      usage={usage}
      symbol={settings.currency_symbol}
      code={settings.currency_code}
      decimals={settings.currency_decimals}
      priceCurrency={priceCurrency}
      cryptoToPrice={cryptoToPrice}
      affiliatePct={Number(settings.aff_comission) || 0}
      rateAvailable={cryptoToPrice > 0}
    />
  );
}
