import { getSettings } from "@/lib/settings";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AffiliatePage() {
  const s = await getSettings();
  let affiliateHtml: string | null = null;
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase.from("contents").select("*").order("id").limit(1).maybeSingle();
    affiliateHtml = (data as { affiliate?: string } | null)?.affiliate ?? null;
  } catch {
    // DB unreachable — fallback copy below.
  }
  return (
    <div className="space-y-4 py-6">
      <h1 className="text-3xl font-bold">Affiliate program — earn {s.aff_comission}%</h1>
      <Card><CardHeader><CardTitle>How it works</CardTitle></CardHeader>
        <CardContent>
          <div dangerouslySetInnerHTML={{ __html: affiliateHtml ?? `<p>Invite friends to ${s.sitename} and earn ${s.aff_comission}% of every upgrade.</p>` }} />
          <p className="mt-4 text-sm text-zinc-500">Your referral link (after login): <code>/referral/YOUR_UNIQUE_ID</code></p>
        </CardContent>
      </Card>
    </div>
  );
}
