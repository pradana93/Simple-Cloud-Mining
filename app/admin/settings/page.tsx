import { getSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const dynamic = "force-dynamic";
export default async function AdminSettings() {
  const s = await getSettings();
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Settings</h1>
    <Card><CardHeader><CardTitle>Site config (Supabase `settings`)</CardTitle></CardHeader><CardContent><pre className="overflow-x-auto text-xs">{JSON.stringify(s, null, 2)}</pre>
    <p className="mt-2 text-sm text-zinc-500">Edit values directly in Supabase Table Editor. Secrets (CoinPayments keys, SMTP) live in Vercel env vars, never in the DB.</p></CardContent></Card></div>;
}
