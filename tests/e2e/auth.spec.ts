import { expect, test } from "@playwright/test";

const username = process.env.E2E_USERNAME ?? "";
const password = process.env.E2E_PASSWORD ?? "";

test.skip(!username || !password, "Set E2E_USERNAME and E2E_PASSWORD to run signed-in checks.");

test("signed-in member can open the verifier and a game page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /enter console/i }).click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

  await page.goto("/games/verify");
  await expect(page.getByRole("heading", { name: "Verify a bet" })).toBeVisible();

  await page.goto("/games");
  await expect(page.locator("body")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("admin ledger is readable when the account is an admin", async ({ page }) => {
  test.skip(process.env.E2E_EXPECT_ADMIN !== "1", "Set E2E_EXPECT_ADMIN=1 for the admin check.");

  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /enter console/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

  await page.goto("/admin/ledger");
  await expect(page.getByRole("heading", { name: "Money ledger" })).toBeVisible();
  await expect(page.locator("body")).toBeVisible();
});
