import { describe, expect, it } from "vitest";
import {
  encodeEventTopics,
  encodeAbiParameters,
  type TransactionReceipt,
} from "viem";

import {
  approvalRequired,
  assertApprovalConfirmed,
  canFundPurchase,
  eventPassPurchaseAbi,
  purchasedPassFromReceipt,
} from "./event-pass-transactions";

const contract = "0x1111111111111111111111111111111111111111";
const buyer = "0x2222222222222222222222222222222222222222";
const eventIdentifier = `0x${"3".repeat(64)}` as const;

function receipt(owner = buyer): TransactionReceipt {
  return {
    status: "success",
    transactionHash: `0x${"a".repeat(64)}`,
    transactionIndex: 0,
    blockHash: `0x${"b".repeat(64)}`,
    blockNumber: 1n,
    from: buyer,
    to: contract,
    cumulativeGasUsed: 1n,
    gasUsed: 1n,
    effectiveGasPrice: 1n,
    contractAddress: null,
    logsBloom: `0x${"0".repeat(512)}`,
    type: "eip1559",
    logs: [
      {
        address: contract,
        blockHash: `0x${"b".repeat(64)}`,
        blockNumber: 1n,
        data: encodeAbiParameters([], []),
        logIndex: 0,
        removed: false,
        transactionHash: `0x${"a".repeat(64)}`,
        transactionIndex: 0,
        topics: encodeEventTopics({
          abi: eventPassPurchaseAbi,
          eventName: "EventPassPurchased",
          args: { pass_id: 42n, event_id: eventIdentifier, buyer: owner },
        }) as [`0x${string}`, ...`0x${string}`[]],
      },
    ],
  };
}

describe("Event Pass purchase transaction semantics", () => {
  it("requests approval only for a short allowance and blocks a short balance", () => {
    expect(approvalRequired(24_999_999n, 25_000_000n)).toBe(true);
    expect(approvalRequired(25_000_000n, 25_000_000n)).toBe(false);
    expect(canFundPurchase(24_999_999n, 25_000_000n)).toBe(false);
    expect(canFundPurchase(25_000_000n, 25_000_000n)).toBe(true);
  });

  it("rejects cancelled or unrelated replacement approvals", () => {
    expect(() =>
      assertApprovalConfirmed({
        receiptStatus: "success",
        cancelled: true,
        allowance: 25_000_000n,
        price: 25_000_000n,
      }),
    ).toThrow("approval failed");
    expect(() =>
      assertApprovalConfirmed({
        receiptStatus: "success",
        cancelled: false,
        allowance: 0n,
        price: 25_000_000n,
      }),
    ).toThrow("approval failed");
  });

  it("accepts exactly one pass issued to the selected buyer", () => {
    expect(
      purchasedPassFromReceipt(receipt(), contract, eventIdentifier, buyer),
    ).toEqual({ passId: "42", transactionHash: `0x${"a".repeat(64)}` });
    expect(() =>
      purchasedPassFromReceipt(
        receipt("0x4444444444444444444444444444444444444444"),
        contract,
        eventIdentifier,
        buyer,
      ),
    ).toThrow("does not belong to the selected wallet");
  });
});
