import { getPublicSupabase } from "./supabase/public";
import { createAdminSupabase } from "./supabase/admin";

// Regression watchdog for the security lockdown (migrations 005/006).
//
// Every probe drives the public anon client, exactly what an attacker with the
// shipped anon key can do, and asserts the operation is still refused. Probes
// are written to be harmless even if a grant regressed: the writes target a
// non-existent id (so they touch no row) or reference a missing key (so a
// constraint, not a privilege, would stop them).
//
// SQLSTATE 42501 = insufficient_privilege, returned both for a missing GRANT
// and for an RLS policy that denies the row.

export type ProbeResult = { key: string; label: string; passed: boolean; detail: string };
export type SecurityCheck = { check_key: string; label: string; passed: boolean; detail: string | null; checked_at: string };

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const DENIED = "42501";

const errCode = (e: unknown) => (e as { code?: string } | null)?.code;
const errMsg = (e: unknown) => (e as { message?: string } | null)?.message ?? "no message";
const errAny = (e: unknown) => Boolean(e);

type Probe = { key: string; label: string; run: () => Promise<{ passed: boolean; detail: string }> };

function probes(): Probe[] {
  const pub = getPublicSupabase();

  // A denied operation is a pass. Anything else is a regression.
  const denied = (error: unknown, what: string): { passed: boolean; detail: string } =>
    errCode(error) === DENIED
      ? { passed: true, detail: `Blocked as expected (42501).` }
      : { passed: false, detail: `${what} was not blocked${error ? `: ${errCode(error)} ${errMsg(error)}` : ""}.` };

  return [
    {
      key: "write_profiles_admin",
      label: "Anon cannot set is_admin on a profile",
      run: async () => {
        const { error } = await pub.from("profiles").update({ is_admin: true }).eq("id", ZERO_UUID);
        return denied(error, "Anon profile update");
      },
    },
    {
      key: "insert_withdrawal",
      label: "Anon cannot insert a withdrawal",
      run: async () => {
        const { error } = await pub.from("user_withdrawal").insert({ user_id: ZERO_UUID, amount: 0, status: "PENDING" });
        return denied(error, "Anon withdrawal insert");
      },
    },
    {
      key: "insert_deposit",
      label: "Anon cannot insert a deposit",
      run: async () => {
        const { error } = await pub.from("user_deposits").insert({ user_id: ZERO_UUID, amount: 0 });
        return denied(error, "Anon deposit insert");
      },
    },
    {
      key: "read_smtp",
      label: "Anon cannot read SMTP credentials",
      run: async () => {
        const { error } = await pub.from("settings").select("smtp_pass").limit(1);
        return denied(error, "Anon smtp_pass read");
      },
    },
    {
      key: "read_login_attempts",
      label: "Anon cannot read login_attempts",
      run: async () => {
        const { error } = await pub.from("login_attempts").select("id").limit(1);
        return denied(error, "Anon login_attempts read");
      },
    },
    {
      key: "read_risk_tables",
      label: "Anon cannot read the risk tables",
      run: async () => {
        const [a, b] = await Promise.all([
          pub.from("account_risk").select("user_id").limit(1),
          pub.from("risk_events").select("id").limit(1),
        ]);
        return errCode(a.error) === DENIED && errCode(b.error) === DENIED
          ? { passed: true, detail: "account_risk and risk_events both blocked (42501)." }
          : { passed: false, detail: "A risk table is reachable by anon." };
      },
    },
    {
      key: "read_security_checks",
      label: "Anon cannot read the security watchdog",
      run: async () => {
        const { error } = await pub.from("security_checks").select("check_key").limit(1);
        return denied(error, "Anon security_checks read");
      },
    },
    {
      key: "rpc_credit_balance",
      label: "Anon cannot call credit_balance",
      run: async () => {
        const { error } = await pub.rpc("credit_balance", { p_user_id: ZERO_UUID, p_amount: 0 });
        return errAny(error)
          ? { passed: true, detail: `Refused (${errCode(error) ?? "error"}).` }
          : { passed: false, detail: "credit_balance ran for anon (amount 0, so nothing changed, but the grant is back)." };
      },
    },
    {
      key: "public_settings_ok",
      label: "Public settings columns still readable",
      run: async () => {
        const { data, error } = await pub.from("settings").select("sitename").limit(1);
        return !error && (data ?? []).length > 0
          ? { passed: true, detail: "sitename readable (positive control)." }
          : { passed: false, detail: error ? `sitename read failed: ${errMsg(error)}` : "sitename returned no rows." };
      },
    },
    {
      key: "legacy_tables_locked",
      label: "Anon cannot read legacy CMS tables",
      run: async () => {
        const tables = ["addon_demo", "addons", "addons_menu", "groups", "profile_groups"];
        for (const table of tables) {
          const { error } = await pub.from(table).select("*").limit(1);
          if (errCode(error) !== DENIED) {
            return { passed: false, detail: `${table} is reachable by anon${error ? `: ${errCode(error)}` : ""}.` };
          }
        }
        return { passed: true, detail: `${tables.length} legacy tables blocked (42501).` };
      },
    },
    {
      key: "secret_tables_locked",
      label: "Anon cannot read 2FA/seeds/attempt logs",
      run: async () => {
        const tables = ["user_2fa", "login_pending_2fa", "game_seeds", "login_attempts", "ipn_errors"];
        for (const table of tables) {
          const { error } = await pub.from(table).select("*").limit(1);
          if (errCode(error) !== DENIED) {
            return { passed: false, detail: `${table} is reachable by anon${error ? `: ${errCode(error)}` : ""}.` };
          }
        }
        return { passed: true, detail: `${tables.length} sensitive tables blocked (42501).` };
      },
    },
    {
      key: "profiles_hidden",
      label: "Anon sees no profile rows",
      run: async () => {
        const { data, error } = await pub.from("profiles").select("id").limit(1);
        return !error && (data ?? []).length === 0
          ? { passed: true, detail: "No profile rows visible to anon (positive control)." }
          : { passed: false, detail: error ? `Unexpected error ${errCode(error)}` : `${(data ?? []).length} profile row(s) leaked.` };
      },
    },
  ];
}

async function persist(results: ProbeResult[]): Promise<void> {
  const rows = results.map((r) => ({
    check_key: r.key,
    label: r.label,
    passed: r.passed,
    detail: r.detail,
    checked_at: new Date().toISOString(),
  }));
  try {
    await createAdminSupabase().from("security_checks").upsert(rows, { onConflict: "check_key" });
  } catch {
    // best effort: a failed write must not mask the probe results
  }
}

export async function runSecurityProbes(): Promise<ProbeResult[]> {
  const list = probes();
  const results: ProbeResult[] = [];
  for (const p of list) {
    let r: { passed: boolean; detail: string };
    try {
      r = await p.run();
    } catch (e) {
      r = { passed: false, detail: e instanceof Error ? e.message : "Probe threw" };
    }
    results.push({ key: p.key, label: p.label, passed: r.passed, detail: r.detail });
  }
  await persist(results);
  return results;
}

export async function getSecurityChecks(): Promise<SecurityCheck[]> {
  try {
    const { data } = await createAdminSupabase()
      .from("security_checks")
      .select("check_key,label,passed,detail,checked_at")
      .order("passed", { ascending: true })
      .order("label", { ascending: true });
    return (data ?? []) as SecurityCheck[];
  } catch {
    return [];
  }
}
