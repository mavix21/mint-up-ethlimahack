import { expect, test } from "@playwright/test";

test.describe("Event Pass buyer surface", () => {
  test("explains Protected payment without exposing the retired account surface", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByText(
        "original en USDC protegido hasta que comience el evento",
        {
          exact: false,
        },
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /wallet/i })).toHaveCount(0);

    await page.goto("/wallet");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });
});
