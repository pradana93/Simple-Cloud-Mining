import { getSecurityChecks } from "@/lib/security-probe";
import { SecurityConsole } from "@/components/admin/security-console";

export const dynamic = "force-dynamic";

export default async function AdminSecurity() {
  const rows = await getSecurityChecks();
  return <SecurityConsole rows={rows} />;
}
