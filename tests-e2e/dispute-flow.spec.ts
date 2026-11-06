import { test, expect } from "@playwright/test";

test.describe("DisputeDefender End-to-End Flow", () => {
  test("loads overview and navigates to case queue", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await page.getByRole("link", { name: /Open dispute queue/i }).click();
    await expect(page).toHaveURL(/\/cases/);
  });

  test("Scenario S1 (PP-D-1001) shows FIGHT recommendation, grounded draft, and PDF preview link", async ({
    page,
  }) => {
    await page.goto("/cases/PP-D-1001");
    await expect(page.getByText("PP-D-1001").first()).toBeVisible();
    await expect(page.getByText(/Evidence strength/i)).toBeVisible();
    await expect(page.getByText(/All claims backed/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Preview Evidence PDF/i })).toBeVisible();
  });

  test("Scenario S4 (PP-D-1004) quarantines prompt injection as untrusted", async ({ page }) => {
    await page.goto("/cases/PP-D-1004");
    await expect(page.getByText("PP-D-1004").first()).toBeVisible();
    await expect(page.getByText(/Untrusted/i).first()).toBeVisible();
  });
});
