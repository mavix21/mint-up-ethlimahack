import { expect, test } from "@playwright/test";

test("visitor opens an eligible Event Pass offer", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Your way into what's next." }),
  ).toBeVisible();
  await page.getByRole("link", { name: /ETH Lima 2026/ }).click();

  await expect(
    page.getByRole("heading", { name: "ETH Lima 2026", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("25 USDC", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("37 of 250 remaining")).toBeVisible();
  await expect(page.getByText(/inclusive/)).toBeVisible();
  await expect(page.getByText(/exclusive/)).toBeVisible();
  await expect(page.getByText(/does not escrow funds/)).toBeVisible();
  await expect(
    page.getByText(/does not automatically return USDC/),
  ).toBeVisible();
});
