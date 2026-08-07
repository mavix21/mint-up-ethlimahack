import { describe, expect, it, vi } from "vitest";

import { resumeOrCreateSponsoredOperation } from "./sponsored-operation-flow";

describe("sponsored operation resume decision", () => {
  it("prepares only when there is no pending operation", async () => {
    const create = vi.fn().mockResolvedValue({ userOperationHash: "0xnew" });
    await expect(
      resumeOrCreateSponsoredOperation({
        resume: vi.fn().mockResolvedValue(null),
        create,
      }),
    ).resolves.toMatchObject({ userOperationHash: "0xnew", resumed: false });
    expect(create).toHaveBeenCalledOnce();
  });

  it("polls a pending operation without preparing or signing again", async () => {
    const create = vi.fn();
    await expect(
      resumeOrCreateSponsoredOperation({
        resume: vi.fn().mockResolvedValue({
          userOperationHash: "0xpending",
          result: { status: "pending" },
        }),
        create,
      }),
    ).resolves.toMatchObject({
      userOperationHash: "0xpending",
      result: { status: "pending" },
      resumed: true,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("surfaces an included operation without preparing again", async () => {
    const create = vi.fn();
    await expect(
      resumeOrCreateSponsoredOperation({
        resume: vi.fn().mockResolvedValue({
          userOperationHash: "0xincluded",
          result: {
            status: "included",
            transactionHash: "0xtransaction",
            blockNumber: "0x10",
          },
        }),
        create,
      }),
    ).resolves.toMatchObject({
      result: { status: "included", transactionHash: "0xtransaction" },
      resumed: true,
    });
    expect(create).not.toHaveBeenCalled();
  });
});
