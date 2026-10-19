import { describe, expect, it } from "vitest";
import { auditLabel } from "@/lib/audit";

describe("auditLabel", () => {
  it("maps known actions to a readable label", () => {
    expect(auditLabel("settings.update")).toBe("Updated site settings");
    expect(auditLabel("withdrawal.approve")).toBe("Approved a withdrawal");
  });

  it("falls back to the raw action for anything unknown", () => {
    expect(auditLabel("something.custom")).toBe("something.custom");
  });
});
