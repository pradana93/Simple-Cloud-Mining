import { createAdminSupabase } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type PlanRow = {
  id: number;
  plan_name: string;
  version: string | null;
  price: number;
  point_per_day: number | null;
  duration: number;
  speed: string | number | null;
};

export default async function AdminPlans() {
  let rows: PlanRow[] = [];
  try {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("plans")
      .select("id,plan_name,version,price,point_per_day,duration,speed")
      .order("price")
      .limit(100);
    rows = (data ?? []) as PlanRow[];
  } catch {
    rows = [];
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">Plans</h1>
      <Card>
        <CardHeader><CardTitle>Published plans ({rows.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto text-sm">
          {rows.length === 0 ? (
            <p className="text-slate-400">No plans published. Add rows to the `plans` table in Supabase to sell hashrate.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 pr-4 font-medium">Price</th>
                  <th className="py-2 pr-4 font-medium">Daily yield</th>
                  <th className="py-2 pr-4 font-medium">Duration</th>
                  <th className="py-2 pr-4 font-medium">Hashrate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-white">{r.plan_name}</span>
                      {r.version ? <span className="ml-2 text-xs text-slate-400">{r.version}</span> : null}
                    </td>
                    <td className="py-2 pr-4 font-mono tabular-nums text-slate-200">{Number(r.price)}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums text-emerald-300">+{Number(r.point_per_day ?? 0)}</td>
                    <td className="py-2 pr-4 text-slate-300">{r.duration} days</td>
                    <td className="py-2 pr-4 text-slate-300">{String(r.speed ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
