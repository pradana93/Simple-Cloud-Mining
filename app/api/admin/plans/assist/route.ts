import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-admin";
import { coerceIntent, parseGoal, solvePlan, type PlanContext } from "@/lib/plan-goal";

export const dynamic = "force-dynamic";

const SYSTEM = `You convert a plan-manager's plain-English goal into JSON describing a reward plan.
Return ONLY a JSON object. Include a key only if the user actually stated or clearly implied it.
Allowed keys (snake_case, numbers without % or currency symbols):
- price: number (what the member pays)
- durationDays: integer
- dailyRatePct: number (percent of price earned per day)
- dailyYield: number (absolute coins earned per day)
- userRoiPct: number (total percent return over the term)
- userMultiple: number (e.g. 1.5 for "1.5x their money")
- ownerMarginPct: number (percent the house keeps)
- name: string (plan name, only if named)
- version: short string
- speed: string (tier label)
- profit: string (short marketing blurb)
- isDefault: boolean (true for the free/starter plan)
Do NOT calculate derived values and do NOT output anything except the JSON object.
If the goal is unclear, return {"isDefault": true} when it says free, otherwise {}.`;

async function extractOpenAI(goal: string, context: PlanContext, key: string): Promise<unknown> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.PLAN_AI_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Goal: ${goal}\nCurrent plan (for context, may be empty): ${JSON.stringify(context)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error("openai");
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
}

async function extractAnthropic(goal: string, context: PlanContext, key: string): Promise<unknown> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.PLAN_AI_MODEL ?? "claude-3-5-haiku-latest",
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        { role: "user", content: `Goal: ${goal}\nCurrent plan (for context, may be empty): ${JSON.stringify(context)}\nReply with the JSON object only.` },
      ],
    }),
  });
  if (!res.ok) throw new Error("anthropic");
  const j = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = j.content?.[0]?.text ?? "{}";
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let body: { goal?: unknown; context?: unknown };
  try {
    body = (await req.json()) as { goal?: unknown; context?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const goal = String(body.goal ?? "").trim();
  if (!goal) return NextResponse.json({ ok: false, error: "Describe the plan first" }, { status: 422 });
  if (goal.length > 600) return NextResponse.json({ ok: false, error: "Keep the goal under 600 characters" }, { status: 422 });
  const context = (body.context ?? {}) as PlanContext;

  const openai = process.env.OPENAI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;

  if (openai || anthropic) {
    try {
      const raw = openai ? await extractOpenAI(goal, context, openai) : await extractAnthropic(goal, context, anthropic as string);
      const intent = coerceIntent(raw);
      if (Object.keys(intent).length > 0) {
        return NextResponse.json({ ok: true, source: openai ? "openai" : "anthropic", proposal: solvePlan(intent, context) });
      }
    } catch {
      // fall through to the built-in engine
    }
  }

  return NextResponse.json({ ok: true, source: "builtin", proposal: solvePlan(parseGoal(goal, context), context) });
}

