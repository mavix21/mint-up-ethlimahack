import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {
  Address,
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
const OPERATOR_KEY =
  "0xc011740e64cd1bcefb4b5b869ac1169f79e8524cd7c6d409b3fe5b7dfd92afa6";
const PRICE = 25_000_000n;
const chain = arbitrumNitro as Chain;

const usdcAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const eventPassAbi = parseAbi([
  "function registerEvent(bytes32 event_id, address revenue_recipient, uint64 price, uint32 maximum_supply, uint64 sale_start, uint64 sale_end, bool sales_enabled, bool transfers_enabled, address check_in_operator)",
  "function purchase(bytes32 event_id) returns (uint64)",
  "function transferPass(uint64 pass_id, address to)",
  "function checkIn(bytes32 event_id, uint64 pass_id)",
  "function passInfo(uint64 pass_id) view returns (address, bytes32, uint8, bool)",
  "event EventPassPurchased(uint64 indexed pass_id, bytes32 indexed event_id, address indexed buyer)",
]);

interface DeploymentFile {
  "mint-up-event-pass": { address: Address };
}

interface LocalDependencies {
  usdc: Address;
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
    chain,
    transport: http(RPC_URL),
  });
  const admin = privateKeyToAccount(ADMIN_KEY as Hex);
  const buyer = privateKeyToAccount(BUYER_KEY as Hex);
  const operator = privateKeyToAccount(OPERATOR_KEY as Hex);
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

  assert.notEqual(await publicClient.getBytecode({ address: usdc }), "0x");
  assert.notEqual(await publicClient.getBytecode({ address: eventPass }), "0x");

  const block = await publicClient.getBlock();
  const now = block.timestamp;
  const eventId = keccak256(toHex(`mint-up-local-${Date.now()}`));

  let hash = await adminWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "mint",
    args: [buyer.address, PRICE],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  hash = await adminWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "registerEvent",
    args: [
      eventId,
      ATTENDEE,
      PRICE,
      10,
      now - 1n,
      now + 3600n,
      true,
      true,
      operator.address,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  hash = await buyerWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "approve",
    args: [eventPass, PRICE],
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
  });
  const purchaseReceipt = await publicClient.waitForTransactionReceipt({ hash });
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
  const passId = purchased.args.pass_id;

  const recipientBalanceAfter = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [ATTENDEE],
  });
  assert.equal(recipientBalanceAfter - recipientBalanceBefore, PRICE);

  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "transferPass",
    args: [passId, ATTENDEE],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  hash = await operatorWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "checkIn",
    args: [eventId, passId],
  });
  await publicClient.waitForTransactionReceipt({ hash });

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

  console.log("✅ Local Event Pass flow completed");
  console.log(`   Event: ${eventId}`);
  console.log(`   Pass: ${passId}`);
  console.log(`   Owner: ${owner}`);
  console.log(`   Paid: ${PRICE} USDC units`);
}

main().catch((error) => {
  console.error("❌ Local Event Pass flow failed:", error);
  process.exit(1);
});
