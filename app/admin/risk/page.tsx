import { getRiskQueue } from "@/lib/risk";
import { RiskConsole } from "@/components/admin/risk-console";

export const dynamic = "force-dynamic";

export default async function AdminRisk() {
  const rows = await getRiskQueue(false);
  return <RiskConsole rows={rows} />;
}
