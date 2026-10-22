import { getAdminSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { MaintenanceActions } from "@/components/admin/maintenance-actions";
import { ResetProgress } from "@/components/admin/reset-progress";

export const dynamic = "force-dynamic";

export default async function AdminSettings() {
  const settings = await getAdminSettings();
  return (
    <div className="space-y-8">
      <SettingsForm initial={settings} />
      <MaintenanceActions />
      <ResetProgress
        symbol={settings.currency_symbol}
        code={settings.currency_code}
        decimals={settings.currency_decimals}
      />
    </div>
  );
}
