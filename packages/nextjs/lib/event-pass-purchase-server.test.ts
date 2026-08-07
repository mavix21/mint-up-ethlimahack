import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  parseAbi,
} from "viem";

vi.mock("server-only", () => ({}));

vi.mock("../contracts/eventPassEnvironment", () => ({
  eventPassEnvironment: {
    chainId: 421614,
    eventPassAddress: "0x1111111111111111111111111111111111111111",
    usdcAddress: "0x2222222222222222222222222222222222222222",
  },
}));

const readContract = vi.fn();
const getBlock = vi.fn();
const getTransactionReceipt = vi.fn();
const getTransaction = vi.fn();

vi.mock("./event-pass-public-client", () => ({
  createEventPassPublicClient: () => ({
    readContract,
    getBlock,
    getTransactionReceipt,
    getTransaction,
  }),
}));

import {
  verifyPreparedPurchaseAvailability,
  verifyEventPassPurchase,
} from "./event-pass-purchase-server";

const purchase = {
  purchaseId: "purchase-1",
  chainId: 421614,
  contractAddress: "0x1111111111111111111111111111111111111111",
  paymentAssetAddress: "0x2222222222222222222222222222222222222222",
  eventIdentifier: `0x${"3".repeat(64)}`,
  buyerAddress: "0x4444444444444444444444444444444444444444",
  revenueRecipient: "0x5555555555555555555555555555555555555555",
  priceAmountSubunits: "25000000",
  remaining: 10,
  expiresAt: Date.now() + 60_000,
};

describe("live Event Pass purchase availability", () => {
  beforeEach(() => {
    readContract
      .mockReset()
      .mockResolvedValueOnce([
        "0x6666666666666666666666666666666666666666",
        purchase.paymentAssetAddress,
        false,
      ])
      .mockResolvedValueOnce([
        purchase.revenueRecipient,
        25_000_000n,
        10,
        2,
        100n,
        200n,
        true,
        true,
        false,
        "0x7777777777777777777777777777777777777777",
      ]);
    getBlock.mockReset().mockResolvedValue({ timestamp: 100n });
    getTransactionReceipt.mockReset();
    getTransaction.mockReset();
  });

  it("accepts sale start inclusively after matching live price and capacity", async () => {
    await expect(
      verifyPreparedPurchaseAvailability(purchase),
    ).resolves.toBeUndefined();
  });

  it("rejects the exclusive sale end", async () => {
    getBlock.mockResolvedValue({ timestamp: 200n });
    await expect(verifyPreparedPurchaseAvailability(purchase)).rejects.toThrow(
      "no longer available onchain",
    );
  });
});

describe("Event Pass purchase reconciliation", () => {
  const ENTRY_POINT = "0x0000000071727de22e5e9d8baf0edac6f37da032" as const;
  const BUNDLER = "0x9999999999999999999999999999999999999999" as const;
  const eventPassAbi = parseAbi([
    "event EventPassPurchased(uint64 indexed pass_id, bytes32 indexed event_id, address indexed buyer)",
  ]);
  const entryPointAbi = parseAbi([
    "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)",
  ]);
  const snapshotBase = {
    ...purchase,
    transactionHash: `0x${"a".repeat(64)}` as `0x${string}`,
    expiresAt: Date.now() + 60_000,
    userOperationHash: `0x${"c".repeat(64)}` as `0x${string}`,
    entryPointAddress: ENTRY_POINT as `0x${string}`,
  };

  function passLog(buyer = purchase.buyerAddress) {
    return {
      data: encodeAbiParameters([], []),
      topics: encodeEventTopics({
        abi: eventPassAbi,
        eventName: "EventPassPurchased",
        args: {
          pass_id: 42n,
          event_id: purchase.eventIdentifier as `0x${string}`,
          buyer: buyer as `0x${string}`,
        },
      }) as [`0x${string}`, ...`0x${string}`[]],
    };
  }
  function userOpLog(
    hash: string,
    sender = purchase.buyerAddress,
    success = true,
  ) {
    return {
      data: encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "bool" },
          { type: "uint256" },
          { type: "uint256" },
        ],
        [0n, success, 0n, 0n],
      ),
      topics: encodeEventTopics({
        abi: entryPointAbi,
        eventName: "UserOperationEvent",
        args: {
          userOpHash: hash as `0x${string}`,
          sender: sender as `0x${string}`,
          paymaster:
            "0x0000000000000000000000000000000000000000" as `0x${string}`,
        },
      }) as [`0x${string}`, ...`0x${string}`[]],
    };
  }
  function transferLog() {
    return {
      data: encodeAbiParameters(
        [{ type: "uint256" }],
        [BigInt(purchase.priceAmountSubunits)],
      ),
      topics: encodeEventTopics({
        abi: erc20Abi,
        eventName: "Transfer",
        args: {
          from: purchase.buyerAddress as `0x${string}`,
          to: purchase.revenueRecipient as `0x${string}`,
        },
      }) as [`0x${string}`, ...`0x${string}`[]],
    };
  }
  function setupMocks(
    opts: {
      receiptStatus?: "success" | "reverted";
      from?: string;
      to?: string | null;
      entryPointHash?: string;
      entryPointSender?: string;
      entryPointSuccess?: boolean;
      entryPointAddress?: string;
      passCount?: number;
      transferValue?: bigint;
      blockTimestamp?: bigint;
      passInfo?: [string, string, number, boolean];
    } = {},
  ) {
    const receiptStatus = opts.receiptStatus ?? "success";
    const from = opts.from ?? purchase.buyerAddress;
    const to = opts.to ?? purchase.contractAddress;
    const passCount = opts.passCount ?? 1;
    const blockTimestamp = opts.blockTimestamp ?? 100n;
    const logs: any[] = [];
    if (opts.entryPointHash) {
      const l = userOpLog(
        opts.entryPointHash,
        opts.entryPointSender ?? purchase.buyerAddress,
        opts.entryPointSuccess ?? true,
      );
      logs.push({
        address: opts.entryPointAddress ?? ENTRY_POINT,
        data: l.data,
        topics: l.topics,
        logIndex: 0,
      });
      const unrelated = userOpLog(
        `0x${"f".repeat(64)}`,
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        true,
      );
      logs.push({
        address: ENTRY_POINT,
        data: unrelated.data,
        topics: unrelated.topics,
        logIndex: 1,
      });
    }
    for (let i = 0; i < passCount; i++) {
      const l = passLog();
      logs.push({
        address: purchase.contractAddress,
        data: l.data,
        topics: l.topics,
        logIndex: logs.length,
      });
    }
    const tl = transferLog();
    logs.push({
      address: purchase.paymentAssetAddress,
      data:
        opts.transferValue !== undefined
          ? encodeAbiParameters([{ type: "uint256" }], [opts.transferValue!])
          : tl.data,
      topics:
        opts.transferValue !== undefined
          ? (encodeEventTopics({
              abi: erc20Abi,
              eventName: "Transfer",
              args: {
                from: purchase.buyerAddress as `0x${string}`,
                to: purchase.revenueRecipient as `0x${string}`,
              },
            }) as [`0x${string}`, ...`0x${string}`[]])
          : tl.topics,
      logIndex: logs.length,
    });
    getTransactionReceipt.mockResolvedValue({
      status: receiptStatus,
      blockNumber: 1n,
      transactionHash: snapshotBase.transactionHash,
      logs,
    });
    getTransaction.mockResolvedValue({
      from,
      to,
      hash: snapshotBase.transactionHash,
    });
    getBlock.mockResolvedValue({ timestamp: blockTimestamp, number: 1n });
    const passInfo = opts.passInfo ?? [
      purchase.buyerAddress,
      purchase.eventIdentifier,
      1,
      true,
    ];
    readContract.mockResolvedValue(passInfo);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a valid ERC-4337 purchase without requiring outer sender/destination", async () => {
    setupMocks({
      entryPointHash: snapshotBase.userOperationHash,
    });
    await expect(verifyEventPassPurchase(snapshotBase)).resolves.toMatchObject({
      passId: "42",
    });
  });

  it("rejects a purchase without ERC-4337 UserOperation", async () => {
    const {
      userOperationHash: _unusedUop,
      entryPointAddress: _unusedEp,
      ...withoutOp
    } = snapshotBase as any;
    void _unusedUop;
    void _unusedEp;
    setupMocks();
    await expect(verifyEventPassPurchase(withoutOp as any)).rejects.toThrow(
      "ERC-4337",
    );
    const missingEntryPoint = {
      ...snapshotBase,
      entryPointAddress: undefined as any,
    };
    setupMocks();
    await expect(
      verifyEventPassPurchase(missingEntryPoint as any),
    ).rejects.toThrow("EntryPoint");
  });

  it("rejects a reverted transaction", async () => {
    setupMocks({
      receiptStatus: "reverted",
      entryPointHash: snapshotBase.userOperationHash,
    });
    await expect(verifyEventPassPurchase(snapshotBase)).rejects.toThrow(
      "failed",
    );
  });

  it("rejects expired preparation", async () => {
    setupMocks({
      blockTimestamp: BigInt(Math.floor(snapshotBase.expiresAt / 1000) + 10),
      entryPointHash: snapshotBase.userOperationHash,
    });
    await expect(verifyEventPassPurchase(snapshotBase)).rejects.toThrow(
      "expired",
    );
  });

  it("rejects wrong EntryPoint, wrong hash, wrong sender, and failed execution", async () => {
    const base = {
      ...snapshotBase,
      userOperationHash: `0x${"c".repeat(64)}` as `0x${string}`,
      entryPointAddress: ENTRY_POINT,
    };
    setupMocks({
      from: BUNDLER,
      to: BUNDLER,
      entryPointHash: base.userOperationHash,
      entryPointAddress: "0x1111111111111111111111111111111111111111",
    });
    await expect(verifyEventPassPurchase(base)).rejects.toThrow(
      "UserOperationEvent",
    );
    setupMocks({
      from: BUNDLER,
      to: BUNDLER,
      entryPointHash: `0x${"d".repeat(64)}`,
    });
    await expect(verifyEventPassPurchase(base)).rejects.toThrow(
      "UserOperationEvent",
    );
    setupMocks({
      from: BUNDLER,
      to: BUNDLER,
      entryPointHash: base.userOperationHash,
      entryPointSender: BUNDLER,
    });
    await expect(verifyEventPassPurchase(base)).rejects.toThrow(
      "UserOperationEvent",
    );
    setupMocks({
      from: BUNDLER,
      to: BUNDLER,
      entryPointHash: base.userOperationHash,
      entryPointSuccess: false,
    });
    await expect(verifyEventPassPurchase(base)).rejects.toThrow(
      "UserOperationEvent",
    );
    const missing = { ...base, entryPointAddress: undefined };
    setupMocks({
      from: BUNDLER,
      to: BUNDLER,
      entryPointHash: base.userOperationHash,
    });
    await expect(verifyEventPassPurchase(missing as any)).rejects.toThrow(
      "EntryPoint",
    );
  });

  it("rejects duplicate purchase events and wrong purchase event data", async () => {
    setupMocks({
      passCount: 2,
      entryPointHash: snapshotBase.userOperationHash,
    });
    await expect(verifyEventPassPurchase(snapshotBase)).rejects.toThrow(
      "exactly one",
    );
    setupMocks({
      passCount: 0,
      entryPointHash: snapshotBase.userOperationHash,
    });
    await expect(verifyEventPassPurchase(snapshotBase)).rejects.toThrow(
      "exactly one",
    );
  });

  it("rejects wrong USDC payment and invalid final state", async () => {
    setupMocks({
      transferValue: 1n,
      entryPointHash: snapshotBase.userOperationHash,
    });
    await expect(verifyEventPassPurchase(snapshotBase)).rejects.toThrow(
      "USDC payment",
    );
    setupMocks({
      passInfo: [
        purchase.buyerAddress,
        purchase.eventIdentifier,
        0,
        true,
      ] as any,
      entryPointHash: snapshotBase.userOperationHash,
    });
    await expect(verifyEventPassPurchase(snapshotBase)).rejects.toThrow(
      "ownership",
    );
    setupMocks({
      passInfo: [BUNDLER, purchase.eventIdentifier, 1, true] as any,
      entryPointHash: snapshotBase.userOperationHash,
    });
    await expect(verifyEventPassPurchase(snapshotBase)).rejects.toThrow(
      "ownership",
    );
    setupMocks({
      passInfo: [
        purchase.buyerAddress,
        purchase.eventIdentifier,
        1,
        false,
      ] as any,
      entryPointHash: snapshotBase.userOperationHash,
    });
    await expect(verifyEventPassPurchase(snapshotBase)).rejects.toThrow(
      "ownership",
    );
  });

  it("ignores unrelated operations in the same bundler transaction", async () => {
    const snapshot = {
      ...snapshotBase,
      userOperationHash: `0x${"c".repeat(64)}` as `0x${string}`,
      entryPointAddress: ENTRY_POINT,
    };
    setupMocks({
      from: BUNDLER,
      to: BUNDLER,
      entryPointHash: snapshot.userOperationHash,
    });
    await expect(verifyEventPassPurchase(snapshot)).resolves.toMatchObject({
      passId: "42",
    });
  });
});
