import { describe, expect, it } from "vitest";
import { backupPageUrl } from "../scripts/lib/backup-page.mjs";

describe("logical backup pagination", () => {
  it("orders rows by id with a stable limit", () => {
    expect(backupPageUrl("https://project.supabase.co/", "profiles", null, 1000)).toBe(
      "https://project.supabase.co/rest/v1/profiles?select=*&order=id.asc&limit=1000"
    );
  });

  it("continues after the last id instead of using an offset", () => {
    const url = backupPageUrl(
      "https://project.supabase.co",
      "balance_ledger",
      "9f8c1a4e-2d3b-4c5d-8e9f-0123456789ab",
      1000
    );
    expect(url).toContain("order=id.asc");
    expect(url).toContain("id=gt.9f8c1a4e-2d3b-4c5d-8e9f-0123456789ab");
    expect(url).not.toContain("offset=");
  });
});
