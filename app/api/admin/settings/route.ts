import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";
import { ALL_FIELDS, type SettingsField } from "@/lib/settings-fields";

export const dynamic = "force-dynamic";

function coerce(field: SettingsField, raw: unknown): { value?: unknown; error?: string } {
  const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");

  switch (field.type) {
    case "number":
    case "slider": {
      if (empty) {
        if (field.required) return { error: `${field.label} is required` };
        return { value: field.nullable ? null : 0 };
      }
      let n = Number(raw);
      if (!Number.isFinite(n)) return { error: `${field.label} must be a number` };
      if (field.integer) n = Math.round(n);
      if (field.min !== undefined && n < field.min) return { error: `${field.label} must be at least ${field.min}` };
      if (field.max !== undefined && n > field.max) return { error: `${field.label} must be at most ${field.max}` };
      return { value: n };
    }
    case "switch": {
      const v = String(raw).toLowerCase();
      if (v !== "yes" && v !== "no") return { error: `${field.label} must be yes or no` };
      return { value: v };
    }
    case "select":
    case "segmented": {
      const v = String(raw);
      if (!field.options?.some((o) => o.value === v)) return { error: `${field.label} has an invalid value` };
      return { value: v };
    }
    default: {
      const s = String(raw).trim();
      if (field.required && !s) return { error: `${field.label} is required` };
      if (field.maxLength && s.length > field.maxLength) {
        return { error: `${field.label} must be ${field.maxLength} characters or fewer` };
      }
      if (field.type === "url" && s && !/^https?:\/\//i.test(s)) {
        return { error: `${field.label} must start with http:// or https://` };
      }
      if (field.type === "date" && s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return { error: `${field.label} must be a valid date` };
      }
      if (s === "") return { value: field.nullable ? null : "" };
      return { value: s };
    }
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const errors: Record<string, string> = {};
  const update: Record<string, unknown> = {};
  for (const field of ALL_FIELDS) {
    const key = field.key as string;
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const r = coerce(field, body[key]);
    if (r.error) errors[key] = r.error;
    else update[key] = r.value;
  }

  const min = Number(update.min_withdraw ?? body.min_withdraw);
  const max = Number(update.max_withdraw ?? body.max_withdraw);
  if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
    errors.max_withdraw = "Max withdrawal must be at least the minimum.";
  }

  if (Object.keys(errors).length) {
    return NextResponse.json({ ok: false, error: "Some fields need attention", errors }, { status: 422 });
  }
  if (!Object.keys(update).length) {
    return NextResponse.json({ ok: false, error: "Nothing to save" }, { status: 400 });
  }

  try {
    const admin = createAdminSupabase();
    const { data: row } = await admin.from("settings").select("id").order("id").limit(1).maybeSingle();
    const id = (row as { id?: number } | null)?.id ?? 1;
    const { error } = await admin.from("settings").update(update).eq("id", id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    revalidateTag("site-settings");
    revalidateTag("site-stats");
    const { data: saved } = await admin.from("settings").select("*").order("id").limit(1).maybeSingle();
    return NextResponse.json({ ok: true, settings: saved });
  } catch {
    return NextResponse.json({ ok: false, error: "Save failed" }, { status: 500 });
  }
}
