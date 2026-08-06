import { expect, test } from "@playwright/test";

const contractAddress = "0xab8e440727a38bbb180f7032ca4a8009e7b52b80";
const usdcAddress = "0x75e0e92a79880bd81a69f72983d03c75e2b33dc8";
const buyerAddress = "0xDD09b55496EaA3cFAe23137ABDeA52a9a979B70e";
const revenueRecipient = "0x2222222222222222222222222222222222222222";
const eventIdentifier = `0x${"1".repeat(64)}`;
const transactionHash = `0x${"a".repeat(64)}`;

test("attendee reviews and purchases one Event Pass with the embedded wallet", async ({
  page,
}) => {
  let statusReads = 0;
  await page.route("**/api/purchases", async route => {
    await route.fulfill({
      json: {
        purchaseId: "purchase-1",
        chainId: 412346,
        contractAddress,
        paymentAssetAddress: usdcAddress,
        eventIdentifier,
        buyerAddress,
        revenueRecipient,
        priceAmountSubunits: "25000000",
        remaining: 37,
        expiresAt: Date.now() + 60_000,
      },
    });
  });
  await page.route("**/api/purchases/purchase-1", async route => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: { accepted: true } });
      return;
    }
    statusReads += 1;
    await route.fulfill({
      json:
        statusReads === 1
          ? { status: "synchronizing", transactionHash }
          : {
              status: "confirmed",
              transactionHash,
              pass: {
                passId: "42",
                eventId: "event_eth_lima_2026",
                owner: buyerAddress,
                issuedTicketId: "ticket-1",
              },
            },
    });
  });

  await page.goto("/passes/event_eth_lima_2026");
  await expect(
    page.getByText("25 USDC", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("37 of 250 remaining")).toBeVisible();
  await expect(page.getByText(/does not escrow funds/)).toBeVisible();
  await expect(page.getByText("Selected embedded wallet")).toBeVisible();
  await expect(page.getByText(buyerAddress)).toBeVisible();

  await page
    .getByRole("button", { name: "Confirm one Event Pass" })
    .click({ force: true });

  await expect(page.getByText("USDC approval: confirmed")).toBeVisible();
  await expect(
    page.getByText("Event Pass #42 confirmed onchain"),
  ).toBeVisible();
  await expect(
    page.getByText("Mint Up synchronization: confirmed"),
  ).toBeVisible();
});
