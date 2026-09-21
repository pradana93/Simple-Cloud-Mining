import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  let faqs: Array<{ id: number; question: string; answer: string }> = [];
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase.from("faqs").select("*").order("id");
    faqs = (data ?? []) as typeof faqs;
  } catch {
    // DB unreachable — render empty list.
  }
  return (
    <div className="space-y-4 py-6">
      <h1 className="text-3xl font-bold">FAQ</h1>
      {(faqs ?? []).map((f) => (
        <Card key={f.id}><CardHeader><CardTitle>{f.question}</CardTitle></CardHeader>
          <CardContent><div dangerouslySetInnerHTML={{ __html: f.answer }} /></CardContent></Card>
      ))}
    </div>
  );
}
