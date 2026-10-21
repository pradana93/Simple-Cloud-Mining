import { expect, test } from "@playwright/test";

test("landing page loads without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Simple Cloud Mining/i);
  await expect(page.locator("body")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("login form is reachable and labelled", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /enter console/i })).toBeVisible();
});

test("verifier redirects anonymous visitors to login", async ({ page }) => {
  await page.goto("/games/verify");
  await expect(page).toHaveURL(/\/login/);
});
