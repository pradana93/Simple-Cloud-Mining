import { createAdminSupabase } from "./supabase/admin";

/**
 * Self-healing profile bootstrap (service-role).
 * Guarantees every authenticated user has: profile row, referral link,
 * and at least one active (free) plan — even if the signup trigger was
 * bypassed or the client insert failed on RLS. Safe to call on every
 * dashboard visit; all steps are idempotent.
 */
export async function ensureProfile(opts: {
  userId: string;
  email: string | null;
  usernameMeta?: string | null;
  refUniqueId?: string | null;
}): Promise<{ created: boolean; username: string | null } | null> {
  try {
    const admin = createAdminSupabase();

    // Resolve referral upline once (never self).
    let uplineId: string | null = null;
    if (opts.refUniqueId && /^\d+$/.test(opts.refUniqueId)) {
      const { data: up } = await admin
        .from("profiles")
        .select("id")
        .eq("unique_id", Number(opts.refUniqueId))
        .maybeSingle();
      const found = (up as { id: string } | null)?.id ?? null;
      uplineId = found && found !== opts.userId ? found : null;
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id,username,reference_user_id")
      .eq("id", opts.userId)
      .maybeSingle();
    let row = profile as { id: string; username: string; reference_user_id: string | null } | null;
    let created = false;

    if (!row) {
      const base = (opts.usernameMeta || (opts.email ?? "").split("@")[0] || "miner").slice(0, 40);
      for (let t = 0; t < 6; t++) {
        const username = t === 0 ? base : `${base}_${t}`;
        const { error } = await admin.from("profiles").insert({
          id: opts.userId,
          username,
          email: opts.email,
          unique_id: Math.floor(10000 + Math.random() * 89999),
          reference_user_id: uplineId,
        });
        if (!error) {
          created = true;
          break;
        }
        if (!/duplicate|unique/i.test(error.message)) break;
      }
      const recheck = await admin
        .from("profiles")
        .select("id,username,reference_user_id")
        .eq("id", opts.userId)
        .maybeSingle();
      row = (recheck as { data: typeof row }).data;
    } else if (!row.reference_user_id && uplineId) {
      await admin.from("profiles").update({ reference_user_id: uplineId }).eq("id", opts.userId);
    }

    // Grant the free (default) plan when the user has no active rig.
    const active = await admin
      .from("user_plan_history")
      .select("id")
      .eq("user_id", opts.userId)
      .eq("status", "active")
      .limit(1);
    if ((((active as { data: unknown }).data ?? []) as unknown[]).length === 0) {
      const { data: def } = await admin
        .from("plans")
        .select("id,duration")
        .eq("is_default", true)
        .order("id")
        .limit(1)
        .maybeSingle();
      const d = def as { id: number; duration: number } | null;
      if (d) {
        await admin.from("user_plan_history").insert({
          user_id: opts.userId,
          plan_id: d.id,
          status: "active",
          expire_date: new Date(Date.now() + Number(d.duration) * 86400000).toISOString(),
          last_sum: new Date().toISOString(),
        });
      }
    }

    return { created, username: row?.username ?? null };
  } catch {
    return null; // e.g. service key missing — pages render anyway
  }
}
