import { createAdminSupabase } from "./supabase/admin";
import { clientIp } from "./risk-telemetry";

// Append-only trail of admin actions. Best effort: a logging failure must never
// block the action it describes, so every write is wrapped.
export type AuditAction =
  | "settings.update"
  | "plan.create"
  | "plan.update"
  | "plan.delete"
  | "member.grant_rig"
  | "member.revoke_rig"
  | "member.balance"
  | "member.role"
  | "member.reset_password"
  | "withdrawal.approve"
  | "withdrawal.reject"
  | "withdrawal.pass"
  | "invoice.cancel"
  | "risk.state"
  | "risk.rescan"
  | "security.run"
  | "maintenance.accrue"
  | "maintenance.revalidate";

export type AuditActor = { id: string; name: string | null };

export const AUDIT_LABELS: Record<string, string> = {
  "settings.update": "Updated site settings",
  "plan.create": "Created a plan",
  "plan.update": "Edited a plan",
  "plan.delete": "Removed a plan",
  "member.grant_rig": "Granted a rig",
  "member.revoke_rig": "Stopped a rig",
  "member.balance": "Adjusted a balance",
  "member.role": "Changed admin access",
  "member.reset_password": "Reset a password",
  "withdrawal.approve": "Approved a withdrawal",
  "withdrawal.reject": "Rejected a withdrawal",
  "withdrawal.pass": "Ran a payout pass",
  "invoice.cancel": "Canceled an invoice",
  "risk.state": "Reviewed a risk flag",
  "risk.rescan": "Ran a risk rescan",
  "security.run": "Ran security checks",
  "maintenance.accrue": "Ran accrual",
  "maintenance.revalidate": "Refreshed public caches",
};

export function auditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action;
}

export async function recordAudit(opts: {
  actor: AuditActor;
  action: AuditAction;
  target?: string | null;
  detail?: Record<string, unknown> | null;
  req?: Request;
}): Promise<void> {
  try {
    await createAdminSupabase()
      .from("admin_audit")
      .insert({
        actor_id: opts.actor.id,
        actor_name: opts.actor.name ?? null,
        action: opts.action,
        target: opts.target ?? null,
        detail: opts.detail ?? null,
        ip: opts.req ? clientIp(opts.req) : null,
      });
  } catch {
    // never surface audit failures
  }
}
