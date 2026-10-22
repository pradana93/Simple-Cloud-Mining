import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-admin";
import { coerceIntent, parseGoal, solvePlan, type PlanContext, type PlanIntent } from "@/lib/plan-goal";
import { generateStrategy, type StrategyBrief, type StrategyObjective } from "@/lib/plan-studio";

export const dynamic = "force-dynamic";

const SYSTEM = `You convert a plan-manager's plain-English goal into JSON describing a reward plan.
Return ONLY a JSON object. Include a key only if the user actually stated or clearly implied it.
Allowed keys (snake_case, numbers without % or currency symbols):
- price: number (what the member pays)
- durationDays: integer
- dailyRatePct: number (percent of price earned per day)
- dailyYield: number (absolute coins earned per day)
- dailyProfit: number (member profit per day in the price currency)
- userRoiPct: number (total percent return over the term)
- userMultiple: number (e.g. 1.5 for "1.5x their money")
- payoutRatioPct: number (percent of price returned to the member)
- ownerMarginPct: number (percent the house keeps)
- name: string (plan name, only if named)
- version: short string
- speed: string (tier label)
- profit: string (short marketing blurb)
- isDefault: boolean (true for the free/starter plan)
Do NOT calculate derived values and do NOT output anything except the JSON object.
If the goal is unclear, return {"isDefault": true} when it says free, otherwise {}.`;

type AiConfig = {
  source: "custom" | "openai" | "anthropic";
  url: string;
  key: string;
  model: string;
  jsonMode: boolean;
};

function aiConfig(): AiConfig | null {
  const base = process.env.PLAN_AI_BASE_URL?.trim();
  const customKey = process.env.PLAN_AI_API_KEY?.trim();
  const model = process.env.PLAN_AI_MODEL?.trim();
  if (base && customKey) {
    return {
      source: "custom",
      url: base.endsWith("/chat/completions") ? base : `${base.replace(/\/$/, "")}/chat/completions`,
      key: customKey,
      model: model || "default",
      jsonMode: false,
    };
  }
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      source: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      key: openai,
      model: model || "gpt-4o-mini",
      jsonMode: true,
    };
  }
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropic) {
    return {
      source: "anthropic",
      url: "https://api.anthropic.com/v1/messages",
      key: anthropic,
      model: model || "claude-3-5-haiku-latest",
      jsonMode: false,
    };
  }
  return null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function objectiveOf(value: unknown): StrategyObjective {
  return value === "profit" || value === "growth" || value === "retention" ? value : "balanced";
}

function parseBrief(raw: unknown): StrategyBrief {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    objective: objectiveOf(r.objective),
    price: numberOrNull(r.price),
    durationDays: numberOrNull(r.durationDays),
    dailyProfit: numberOrNull(r.dailyProfit),
    targetRoiPct: numberOrNull(r.targetRoiPct),
    minMarginPct: numberOrNull(r.minMarginPct),
    maxPayoutRatioPct: numberOrNull(r.maxPayoutRatioPct),
    freePlan: r.freePlan === true || r.freePlan === "true",
  };
}

async function extractCompatible(
  goal: string,
  context: PlanContext,
  config: AiConfig
): Promise<unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Goal: ${goal}\nCurrent plan (for context, may be empty): ${JSON.stringify(context)}` },
    ],
  };
  if (config.jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${config.source} returned ${res.status}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
}

async function extractAnthropic(goal: string, context: PlanContext, config: AiConfig): Promise<unknown> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      "x-api-key": config.key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Goal: ${goal}\nCurrent plan (for context, may be empty): ${JSON.stringify(context)}\nReply with the JSON object only.`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`anthropic returned ${res.status}`);
  const j = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = j.content?.[0]?.text ?? "{}";
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

async function readIntent(
  goal: string,
  context: PlanContext,
  config: AiConfig | null
): Promise<{ intent: PlanIntent; source: string }> {
  if (!goal) return { intent: {}, source: "builtin" };
  if (config) {
    try {
      const raw =
        config.source === "anthropic"
          ? await extractAnthropic(goal, context, config)
          : await extractCompatible(goal, context, config);
      const intent = coerceIntent(raw);
      if (Object.keys(intent).length > 0) return { intent, source: config.source };
    } catch {
      // A provider failure must not block the local planner.
    }
  }
  return { intent: parseGoal(goal, context), source: "builtin" };
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let body: { goal?: unknown; context?: unknown; brief?: unknown; mode?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const goal = String(body.goal ?? "").trim();
  if (goal.length > 600) {
    return NextResponse.json({ ok: false, error: "Keep the goal under 600 characters" }, { status: 422 });
  }
  const context = (body.context ?? {}) as PlanContext;
  const brief = parseBrief(body.brief);
  const hasBrief = Boolean(
    brief.price != null ||
      brief.durationDays != null ||
      brief.dailyProfit != null ||
      brief.targetRoiPct != null ||
      brief.freePlan ||
      body.mode === "strategy"
  );
  if (!goal && !hasBrief) {
    return NextResponse.json({ ok: false, error: "Describe the plan first" }, { status: 422 });
  }

  const config = aiConfig();
  const { intent, source } = await readIntent(goal, context, config);

  if (body.mode === "strategy") {
    const result = generateStrategy(intent, brief, context);
    if (result.variants.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: result.warnings[0] ?? "Could not build a viable strategy.",
          source,
          aiConfigured: Boolean(config),
          warnings: result.warnings,
        },
        { status: 422 }
      );
    }
    return NextResponse.json({
      ok: true,
      source,
      aiConfigured: Boolean(config),
      objective: result.objective,
      variants: result.variants,
      recommendedId: result.recommendedId,
      assumptions: result.assumptions,
      warnings: result.warnings,
      understood: result.understood,
    });
  }

  return NextResponse.json({
    ok: true,
    source,
    aiConfigured: Boolean(config),
    proposal: solvePlan(intent, context),
  });
}
