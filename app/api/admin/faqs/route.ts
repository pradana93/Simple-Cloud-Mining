import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";

export const dynamic = "force-dynamic";

function parse(body: Record<string, unknown>) {
  const question = String(body.question ?? "").trim().slice(0, 191);
  const answer = String(body.answer ?? "").trim();
  const errors: Record<string, string> = {};
  if (!question) errors.question = "Question is required";
  if (!answer) errors.answer = "Answer is required";
  return { errors, value: { question, answer } };
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
  const { error } = await createAdminSupabase().from("faqs").insert(value);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  revalidateTag("faqs");
  return NextResponse.json({ ok: true, message: "FAQ added" });
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
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "FAQ id is required" }, { status: 400 });
  const { errors, value } = parse(body);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, error: "Check the highlighted fields", errors }, { status: 422 });
  const { error } = await createAdminSupabase().from("faqs").update(value).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  revalidateTag("faqs");
  return NextResponse.json({ ok: true, message: "FAQ updated" });
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
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "FAQ id is required" }, { status: 400 });
  const { error } = await createAdminSupabase().from("faqs").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  revalidateTag("faqs");
  return NextResponse.json({ ok: true, message: "FAQ removed" });
}
