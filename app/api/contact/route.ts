import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/risk-telemetry";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  if (String(body.company ?? "").trim()) {
    return NextResponse.json({ ok: true, message: "Message received." });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const reference = String(body.reference ?? "").trim().slice(0, 191);

  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ ok: false, error: "Enter your name." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 191) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (subject.length < 5 || subject.length > 191) {
    return NextResponse.json({ ok: false, error: "Enter a subject of at least 5 characters." }, { status: 400 });
  }
  if (message.length < 10 || message.length > 5000) {
    return NextResponse.json({ ok: false, error: "Enter a message between 10 and 5000 characters." }, { status: 400 });
  }

  const ip = clientIp(req) || "unknown";
  const admin = createAdminSupabase();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count } = await admin
    .from("contact_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_WINDOW) {
    return NextResponse.json(
      { ok: false, error: "Too many messages from this connection. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const { error: attemptError } = await admin.from("contact_attempts").insert({ ip });
  if (attemptError) {
    return NextResponse.json({ ok: false, error: "Could not accept the message. Try again." }, { status: 500 });
  }

  const { error } = await admin.from("contact").insert({ name, email, subject, message, reference });
  if (error) {
    return NextResponse.json({ ok: false, error: "Could not send the message. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Message received. We reply within 24 hours." });
}
