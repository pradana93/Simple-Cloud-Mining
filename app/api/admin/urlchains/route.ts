import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";

export const dynamic = "force-dynamic";

function parse(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim().slice(0, 191);
  const url = String(body.url ?? "").trim().slice(0, 191);
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required";
  try {
    new URL(url);
  } catch {
    errors.url = "Enter a valid URL (include https://)";
  }
  return { errors, value: { name, url } };
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
  const { errors, value } = parse(body);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, error: "Check the highlighted fields", errors }, { status: 422 });
  const { error } = await createAdminSupabase().from("urlchains").insert(value);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: "Explorer added" });
}

export async function PATCH(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Explorer id is required" }, { status: 400 });
  const { errors, value } = parse(body);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, error: "Check the highlighted fields", errors }, { status: 422 });
  const { error } = await createAdminSupabase().from("urlchains").update(value).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: "Explorer updated" });
}

export async function DELETE(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  let body: { id?: unknown };
  try {
    body = (await req.json()) as { id?: unknown };
  } catch {
    body = {};
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Explorer id is required" }, { status: 400 });
  const { error } = await createAdminSupabase().from("urlchains").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: "Explorer removed" });
}
