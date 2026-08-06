import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {
  Address,
  Abi,
  Chain,
  Hex,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  keccak256,
  parseAbi,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumNitro } from "../../../nextjs/utils/scaffold-stylus/supportedChains";

const RPC_URL = "http://localhost:8547";
const ADMIN_KEY =
  "0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659";
const BUYER_KEY =
  "0x64cf8b4376aca8e153f2aca74b7f5f59e19b8bbb2da594a98095729ba12a9f6c";
const ATTENDEE = "0xE9cB1563bE49002383D08386ee287aF7BAD08c3b";
const ATTENDEE_KEY =
  "0x7a56d99de9eb0977d6dfab1f8465b2705a4c3ca9342ad4fc8cc97aa6f42056c4";
const OPERATOR_KEY =
  "0xc011740e64cd1bcefb4b5b869ac1169f79e8524cd7c6d409b3fe5b7dfd92afa6";
const PRICE = 25_000_000n;
const UNAUTHORIZED = 1;
const EVENT_CANCELLED = 5;
const OUTSIDE_SALE_WINDOW = 7;
const NOT_PASS_OWNER = 10;
const TRANSFERS_DISABLED = 11;
const PASS_NOT_ACTIVE = 12;
const PAYMENT_FAILED = 14;
const PAUSED = 15;
const chain = arbitrumNitro as Chain;

const usdcAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const eventPassAbi = parseAbi([
  "error MintUpError(uint8)",
  "function registerEvent(bytes32 event_id, address revenue_recipient, uint64 price, uint32 maximum_supply, uint64 sale_start, uint64 sale_end, bool sales_enabled, bool transfers_enabled, address check_in_operator)",
  "function cancelEvent(bytes32 event_id)",
  "function setPaused(bool paused)",
  "function purchase(bytes32 event_id) returns (uint64)",
  "function eventInfo(bytes32 event_id) view returns (address, uint64, uint32, uint32, uint64, uint64, bool, bool, bool, address)",
  "function transferPass(uint64 pass_id, address to)",
  "function checkIn(bytes32 event_id, uint64 pass_id)",
  "function passInfo(uint64 pass_id) view returns (address, bytes32, uint8, bool)",
  "event EventPassPurchased(uint64 indexed pass_id, bytes32 indexed event_id, address indexed buyer)",
  "event EventPassTransferred(uint64 indexed pass_id, address indexed previous_owner, address indexed new_owner, bytes32 event_id)",
  "event EventPassCheckedIn(uint64 indexed pass_id, bytes32 indexed event_id, address indexed attendee)",
  "event EventCancelled(bytes32 indexed event_id)",
  "event ContractPaused(bool paused)",
]);

interface DeploymentFile {
  "mint-up-event-pass": { address: Address };
}

interface LocalDependencies {
  usdc: Address;
}

function eventNames(logs: readonly { data: Hex; topics: readonly Hex[] }[]) {
  return logs.flatMap((entry) => {
    try {
      return [
        decodeEventLog({
          abi: eventPassAbi,
          data: entry.data,
          topics: entry.topics as [Hex, ...Hex[]],
        }).eventName,
      ];
    } catch {
      return [];
    }
  });
}

async function expectMintUpError(promise: Promise<unknown>, code: number) {
  try {
    await promise;
    assert.fail(`Expected MintUpError(${code})`);
  } catch (error) {
    let cause: unknown = error;
    while (cause && typeof cause === "object") {
      const data = (
        cause as { data?: { args?: readonly unknown[]; errorName?: string } }
      ).data;
      if (data?.errorName === "MintUpError") {
        assert.equal(Number(data.args?.[0]), code);
        return;
      }
      cause = (cause as { cause?: unknown }).cause;
    }
    throw error;
  }
}

async function waitUntil(timestamp: bigint) {
  while (BigInt(Math.floor(Date.now() / 1000)) < timestamp) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function main() {
  const deploymentsDir = path.resolve(__dirname, "../../deployments");
  const deployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, "412346_latest.json"), "utf8"),
  ) as DeploymentFile;
  const dependencies = JSON.parse(
    fs.readFileSync(
      path.join(deploymentsDir, "412346_local-deps.json"),
      "utf8",
    ),
  ) as LocalDependencies;
  const eventPass = deployment["mint-up-event-pass"].address;
  const usdc = dependencies.usdc;

  const publicClient = createPublicClient({
    cacheTime: 0,
    chain,
    transport: http(RPC_URL),
  });
  const admin = privateKeyToAccount(ADMIN_KEY as Hex);
  const buyer = privateKeyToAccount(BUYER_KEY as Hex);
  const operator = privateKeyToAccount(OPERATOR_KEY as Hex);
  const attendee = privateKeyToAccount(ATTENDEE_KEY as Hex);
  const adminWallet = createWalletClient({
    account: admin,
    chain,
    transport: http(RPC_URL),
  });
  const buyerWallet = createWalletClient({
    account: buyer,
    chain,
    transport: http(RPC_URL),
  });
  const operatorWallet = createWalletClient({
    account: operator,
    chain,
    transport: http(RPC_URL),
  });

  const usdcBytecode = await publicClient.getBytecode({ address: usdc });
  const eventPassBytecode = await publicClient.getBytecode({
    address: eventPass,
  });
  assert(usdcBytecode && usdcBytecode !== "0x", "Mock USDC is not deployed");
  assert(
    eventPassBytecode && eventPassBytecode !== "0x",
    "Event Pass is not deployed",
  );

  const eventId = keccak256(toHex(`mint-up-local-${Date.now()}`));
  const cancelledEventId = keccak256(
    toHex(`mint-up-local-cancelled-${Date.now()}`),
  );

  let hash = await adminWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "mint",
    args: [buyer.address, PRICE * 2n],
  });
  const mintReceipt = await publicClient.waitForTransactionReceipt({ hash });
  const now = (
    await publicClient.getBlock({ blockHash: mintReceipt.blockHash })
  ).timestamp;
  const saleStart = now + 60n;
  const saleEnd = saleStart + 60n;

  hash = await adminWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "registerEvent",
    args: [
      eventId,
      ATTENDEE,
      PRICE,
      10,
      saleStart,
      saleEnd,
      true,
      true,
      operator.address,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  hash = await adminWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "registerEvent",
    args: [
      cancelledEventId,
      ATTENDEE,
      PRICE,
      1,
      saleStart,
      saleEnd + 3600n,
      true,
      false,
      operator.address,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  await waitUntil(saleStart);
  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "purchase",
      args: [eventId],
    }),
    PAYMENT_FAILED,
  );
  const [, , , supplyWithoutAllowance] = await publicClient.readContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "eventInfo",
    args: [eventId],
  });
  assert.equal(supplyWithoutAllowance, 0);
  hash = await buyerWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "approve",
    args: [eventPass, PRICE * 2n],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const recipientBalanceBefore = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [ATTENDEE],
  });
  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "purchase",
    args: [eventId],
    gas: 2_000_000n,
  });
  const purchaseReceipt = await publicClient.waitForTransactionReceipt({
    hash,
  });
  assert.equal(
    (await publicClient.getBlock({ blockHash: purchaseReceipt.blockHash }))
      .timestamp,
    saleStart,
  );
  assert(eventNames(purchaseReceipt.logs).includes("EventPassPurchased"));
  const purchased = purchaseReceipt.logs
    .map((entry) => {
      try {
        return decodeEventLog({
          abi: eventPassAbi,
          data: entry.data,
          topics: entry.topics,
        });
      } catch {
        return undefined;
      }
    })
    .find((entry) => entry?.eventName === "EventPassPurchased");
  assert(purchased && "pass_id" in purchased.args);
  assert.equal(purchased.args.event_id, eventId);
  assert.equal(purchased.args.buyer.toLowerCase(), buyer.address.toLowerCase());
  const passId = purchased.args.pass_id;
  const [, , , issuedSupply] = await publicClient.readContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "eventInfo",
    args: [eventId],
  });
  assert.equal(issuedSupply, 1);

  const recipientBalanceAfter = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [ATTENDEE],
  });
  assert.equal(recipientBalanceAfter - recipientBalanceBefore, PRICE);
  assert.equal(
    await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [eventPass],
    }),
    0n,
  );

  const [purchasingOwner] = await publicClient.readContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "passInfo",
    args: [passId],
  });
  assert.equal(purchasingOwner.toLowerCase(), buyer.address.toLowerCase());

  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "purchase",
    args: [cancelledEventId],
  });
  const disabledTransferPurchase = await publicClient.waitForTransactionReceipt(
    { hash },
  );
  const disabledTransferPass = disabledTransferPurchase.logs
    .map((entry) => {
      try {
        return decodeEventLog({
          abi: eventPassAbi,
          data: entry.data,
          topics: entry.topics,
        });
      } catch {
        return undefined;
      }
    })
    .find((entry) => entry?.eventName === "EventPassPurchased");
  assert(disabledTransferPass && "pass_id" in disabledTransferPass.args);
  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "transferPass",
      args: [disabledTransferPass.args.pass_id, admin.address],
    }),
    TRANSFERS_DISABLED,
  );

  await expectMintUpError(
    publicClient.simulateContract({
      account: attendee,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "transferPass",
      args: [passId, admin.address],
    }),
    NOT_PASS_OWNER,
  );

  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "transferPass",
    args: [passId, ATTENDEE],
  });
  const transferReceipt = await publicClient.waitForTransactionReceipt({
    hash,
  });
  assert(eventNames(transferReceipt.logs).includes("EventPassTransferred"));
  const transferred = decodeEventLog({
    abi: eventPassAbi,
    data: transferReceipt.logs[0]!.data,
    topics: transferReceipt.logs[0]!.topics,
  });
  assert(transferred.eventName === "EventPassTransferred");
  assert.equal(transferred.args.pass_id, passId);
  assert.equal(
    transferred.args.previous_owner.toLowerCase(),
    buyer.address.toLowerCase(),
  );
  assert.equal(
    transferred.args.new_owner.toLowerCase(),
    ATTENDEE.toLowerCase(),
  );
  assert.equal(transferred.args.event_id, eventId);

  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "checkIn",
      args: [eventId, passId],
    }),
    UNAUTHORIZED,
  );

  hash = await operatorWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "checkIn",
    args: [eventId, passId],
  });
  const checkInReceipt = await publicClient.waitForTransactionReceipt({ hash });
  assert(eventNames(checkInReceipt.logs).includes("EventPassCheckedIn"));
  const checkedIn = decodeEventLog({
    abi: eventPassAbi,
    data: checkInReceipt.logs[0]!.data,
    topics: checkInReceipt.logs[0]!.topics,
  });
  assert(checkedIn.eventName === "EventPassCheckedIn");
  assert.equal(checkedIn.args.pass_id, passId);
  assert.equal(checkedIn.args.event_id, eventId);
  assert.equal(checkedIn.args.attendee.toLowerCase(), ATTENDEE.toLowerCase());

  await expectMintUpError(
    publicClient.simulateContract({
      account: operator,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "checkIn",
      args: [eventId, passId],
    }),
    PASS_NOT_ACTIVE,
  );
  await expectMintUpError(
    publicClient.simulateContract({
      account: attendee,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "transferPass",
      args: [passId, buyer.address],
    }),
    PASS_NOT_ACTIVE,
  );

  const [owner, storedEventId, state, valid] = await publicClient.readContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "passInfo",
    args: [passId],
  });
  assert.equal(owner.toLowerCase(), ATTENDEE.toLowerCase());
  assert.equal(storedEventId, eventId);
  assert.equal(state, 2);
  assert.equal(valid, false);

  hash = await adminWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "cancelEvent",
    args: [cancelledEventId],
  });
  const cancellationReceipt = await publicClient.waitForTransactionReceipt({
    hash,
  });
  assert(eventNames(cancellationReceipt.logs).includes("EventCancelled"));
  const cancelled = decodeEventLog({
    abi: eventPassAbi,
    data: cancellationReceipt.logs[0]!.data,
    topics: cancellationReceipt.logs[0]!.topics,
  });
  assert(cancelled.eventName === "EventCancelled");
  assert.equal(cancelled.args.event_id, cancelledEventId);
  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "purchase",
      args: [cancelledEventId],
    }),
    EVENT_CANCELLED,
  );

  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "setPaused",
      args: [true],
    }),
    UNAUTHORIZED,
  );
  hash = await adminWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "setPaused",
    args: [true],
  });
  const pauseReceipt = await publicClient.waitForTransactionReceipt({ hash });
  assert(eventNames(pauseReceipt.logs).includes("ContractPaused"));
  const paused = decodeEventLog({
    abi: eventPassAbi,
    data: pauseReceipt.logs[0]!.data,
    topics: pauseReceipt.logs[0]!.topics,
  });
  assert(paused.eventName === "ContractPaused");
  assert.equal(paused.args.paused, true);
  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "purchase",
      args: [eventId],
    }),
    PAUSED,
  );
  hash = await adminWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "setPaused",
    args: [false],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  await waitUntil(saleEnd);
  hash = await adminWallet.sendTransaction({
    account: admin,
    chain,
    to: admin.address,
    value: 0n,
  });
  const endReceipt = await publicClient.waitForTransactionReceipt({ hash });
  assert.equal(
    (await publicClient.getBlock({ blockHash: endReceipt.blockHash }))
      .timestamp,
    saleEnd,
  );
  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "purchase",
      args: [eventId],
    }),
    OUTSIDE_SALE_WINDOW,
  );

  console.log("Local Event Pass black-box flow completed");
  console.log(`   Event: ${eventId}`);
  console.log(`   Pass: ${passId}`);
  console.log(`   Owner: ${owner}`);
  console.log(`   Paid: ${PRICE} USDC units`);
}

main().catch((error) => {
  console.error("❌ Local Event Pass flow failed:", error);
  process.exit(1);
});
