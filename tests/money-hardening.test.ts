import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { idempotencyKey } from "@/lib/ledger";

const migration = readFileSync(
  path.join(process.cwd(), "supabase", "021_money_hardening.sql"),
  "utf8"
);

describe("money hardening migration", () => {
  it("walks every active plan in id order", () => {
    expect(migration).toContain("id > v_last_id");
    expect(migration).toContain("order by id");
    expect(migration).toContain("limit 1000");
    expect(migration).toContain("exit when v_batch < 1000");
  });

  it("keys admin plan grants for retry safety", () => {
    expect(migration).toContain("add column if not exists idempotency_key text");
    expect(migration).toContain("idx_user_plan_history_idempotency");
  });

  it("writes the crash verifier row inside the settlement transaction", () => {
    expect(migration).toContain("insert into public.game_bets");
    expect(migration).toContain("':crash:bet:'");
    expect(migration).toContain("on conflict do nothing");
  });
});

describe("idempotency keys", () => {
  it("are stable for retries and scoped to the actor and action", () => {
    const key = idempotencyKey("admin-1", "admin-grant:member-1", "attempt-1");
    expect(key).toBe("admin-1:admin-grant:member-1:attempt-1");
    expect(idempotencyKey("admin-2", "admin-grant:member-1", "attempt-1")).not.toBe(key);
  });
});
