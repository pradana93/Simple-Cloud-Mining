import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { MaintenanceActions } from "@/components/admin/maintenance-actions";

export const dynamic = "force-dynamic";

export default async function AdminSettings() {
  const settings = await getSettings();
  return (
    <div className="space-y-8">
      <SettingsForm initial={settings} />
      <MaintenanceActions />
    </div>
  );
}
