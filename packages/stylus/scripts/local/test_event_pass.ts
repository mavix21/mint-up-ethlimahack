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
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumNitro } from "../../../nextjs/utils/scaffold-stylus/supportedChains";
import eventPassAbi from "../generated/mint-up-event-pass";

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
const RESALE_PRICE = 30_000_001n;
const METADATA_URI =
  "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/local-event.json";
const UNAUTHORIZED = 1;
const EVENT_CANCELLED = 5;
const OUTSIDE_SALE_WINDOW = 7;
const NOT_PASS_OWNER = 10;
const TRANSFERS_DISABLED = 11;
const PASS_NOT_ACTIVE = 12;
const PAYMENT_FAILED = 14;
const PAUSED = 15;
const MOVEMENT_RESTRICTED = 18;
const INVALID_AUTHORIZATION = 19;
const REFUND_ALREADY_CLAIMED = 24;
const FUNDS_ALREADY_RELEASED = 27;
const NOT_DESIGNATED_BUYER = 30;
const chain = arbitrumNitro as Chain;

const usdcAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function setFailTransferTo(address recipient)",
  "function setReentry(address target, bytes data)",
  "function reentryAttempted() view returns (bool)",
  "function reentrySucceeded() view returns (bool)",
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

function splitSignature(signature: Hex) {
  return {
    r: `0x${signature.slice(2, 66)}` as Hex,
    s: `0x${signature.slice(66, 130)}` as Hex,
    v: Number.parseInt(signature.slice(130, 132), 16),
  };
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
  const attendeeWallet = createWalletClient({
    account: attendee,
    chain,
    transport: http(RPC_URL),
  });
  const signAuthorization = async ({
    operation,
    caller,
    passId,
    recipient,
    amount,
    nonce,
    issuedAt,
    deadline,
  }: {
    operation: Hex;
    caller: Address;
    passId: bigint;
    recipient: Address;
    amount: bigint;
    nonce: bigint;
    issuedAt: bigint;
    deadline: bigint;
  }) =>
    splitSignature(
      await operator.signTypedData({
        domain: {
          name: "Mint Up",
          version: "1",
          chainId: chain.id,
          verifyingContract: eventPass,
        },
        types: {
          MintUpAuthorization: [
            { name: "operation", type: "bytes32" },
            { name: "caller", type: "address" },
            { name: "passId", type: "uint64" },
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "issuedAt", type: "uint64" },
            { name: "deadline", type: "uint64" },
          ],
        },
        primaryType: "MintUpAuthorization",
        message: {
          operation,
          caller,
          passId,
          recipient,
          amount,
          nonce,
          issuedAt,
          deadline,
        },
      }),
    );

  const usdcBytecode = await publicClient.getBytecode({ address: usdc });
  const eventPassBytecode = await publicClient.getBytecode({
    address: eventPass,
  });
  assert(usdcBytecode && usdcBytecode !== "0x", "Mock USDC is not deployed");
  assert(
    eventPassBytecode && eventPassBytecode !== "0x",
    "Event Pass is not deployed",
  );
  const [, , authorizationSigner, feeRecipient] =
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "config",
    });
  assert.equal(
    authorizationSigner.toLowerCase(),
    operator.address.toLowerCase(),
    "Local deployment authorization signer must match OPERATOR_KEY",
  );
  const [
    transferOperation,
    createResaleOfferOperation,
    cancelResaleOfferOperation,
    purchaseResaleOperation,
  ] = await Promise.all([
    publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "transferOperation",
    }),
    publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "createResaleOfferOperation",
    }),
    publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "cancelResaleOfferOperation",
    }),
    publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "purchaseResaleOperation",
    }),
  ]);
  assert.equal(transferOperation, keccak256(toHex("TRANSFER_PASS")));
  assert.equal(
    createResaleOfferOperation,
    keccak256(toHex("CREATE_RESALE_OFFER")),
  );
  assert.equal(
    cancelResaleOfferOperation,
    keccak256(toHex("CANCEL_RESALE_OFFER")),
  );
  assert.equal(purchaseResaleOperation, keccak256(toHex("PURCHASE_RESALE")));
  for (const interfaceId of [
    "0x01ffc9a7",
    "0x80ac58cd",
    "0x5b5e139f",
  ] as const) {
    assert.equal(
      await publicClient.readContract({
        address: eventPass,
        abi: eventPassAbi,
        functionName: "supportsInterface",
        args: [interfaceId],
      }),
      true,
    );
  }
  assert.equal(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "supportsInterface",
      args: ["0x780e9d63"],
    }),
    false,
  );
  assert.equal(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "name",
    }),
    "Mint Up Event Pass",
  );
  assert.equal(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "symbol",
    }),
    "MUEP",
  );

  const eventId = keccak256(toHex(`mint-up-local-${Date.now()}`));
  const cancelledEventId = keccak256(
    toHex(`mint-up-local-cancelled-${Date.now()}`),
  );
  const resaleEventId = keccak256(toHex(`mint-up-local-resale-${Date.now()}`));

  let hash = await adminWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "mint",
    args: [buyer.address, PRICE * 3n],
  });
  const mintReceipt = await publicClient.waitForTransactionReceipt({ hash });
  hash = await adminWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "mint",
    args: [attendee.address, RESALE_PRICE],
  });
  await publicClient.waitForTransactionReceipt({ hash });

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
      resaleEventId,
      ATTENDEE,
      PRICE,
      1,
      saleStart,
      saleEnd + 3600n,
      saleEnd + 7200n,
      true,
      true,
      operator.address,
      METADATA_URI,
    ],
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
      saleStart,
      saleEnd,
      saleEnd,
      true,
      true,
      operator.address,
      METADATA_URI,
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
      saleEnd + 7200n,
      true,
      false,
      operator.address,
      METADATA_URI,
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
    args: [eventPass, PRICE * 3n],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const contractBalanceBefore = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [eventPass],
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
  assert(eventNames(purchaseReceipt.logs).includes("Transfer"));
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
  const minted = purchaseReceipt.logs
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
    .find((entry) => entry?.eventName === "Transfer");
  assert(minted?.eventName === "Transfer");
  assert.equal(minted.args.from, "0x0000000000000000000000000000000000000000");
  assert.equal(minted.args.to.toLowerCase(), buyer.address.toLowerCase());
  assert.equal(minted.args.token_id, passId);
  const [, , , issuedSupply] = await publicClient.readContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "eventInfo",
    args: [eventId],
  });
  assert.equal(issuedSupply, 1);

  const contractBalanceAfter = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [eventPass],
  });
  assert.equal(contractBalanceAfter - contractBalanceBefore, PRICE);
  const [, protectedBalance] = await publicClient.readContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "eventProtectionInfo",
    args: [eventId],
  });
  assert.equal(protectedBalance, PRICE);

  const [purchasingOwner] = await publicClient.readContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "passInfo",
    args: [passId],
  });
  assert.equal(purchasingOwner.toLowerCase(), buyer.address.toLowerCase());
  assert.equal(
    (
      await publicClient.readContract({
        address: eventPass,
        abi: eventPassAbi,
        functionName: "ownerOf",
        args: [passId],
      })
    ).toLowerCase(),
    buyer.address.toLowerCase(),
  );
  assert.equal(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "balanceOf",
      args: [buyer.address],
    }),
    1n,
  );
  assert.equal(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "tokenURI",
      args: [passId],
    }),
    METADATA_URI,
  );

  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "purchase",
    args: [resaleEventId],
    gas: 2_000_000n,
  });
  const resalePassPurchase = await publicClient.waitForTransactionReceipt({
    hash,
  });
  const resalePassPurchased = resalePassPurchase.logs
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
  assert(resalePassPurchased && "pass_id" in resalePassPurchased.args);
  assert.equal(resalePassPurchased.args.event_id, resaleEventId);
  const resalePassId = resalePassPurchased.args.pass_id;
  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "createResaleOffer",
      args: [
        resalePassId,
        attendee.address,
        RESALE_PRICE,
        10n,
        saleStart,
        saleEnd,
        27,
        toHex(0, { size: 32 }),
        toHex(0, { size: 32 }),
      ],
    }),
    INVALID_AUTHORIZATION,
  );
  const offerIssuedAt = (await publicClient.getBlock()).timestamp;
  const offerDeadline = offerIssuedAt + 60n;
  const offerSignature = await signAuthorization({
    operation: createResaleOfferOperation,
    caller: buyer.address,
    passId: resalePassId,
    recipient: attendee.address,
    amount: RESALE_PRICE,
    nonce: 10n,
    issuedAt: offerIssuedAt,
    deadline: offerDeadline,
  });
  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "createResaleOffer",
    args: [
      resalePassId,
      attendee.address,
      RESALE_PRICE,
      10n,
      offerIssuedAt,
      offerDeadline,
      offerSignature.v,
      offerSignature.r,
      offerSignature.s,
    ],
  });
  const offerReceipt = await publicClient.waitForTransactionReceipt({ hash });
  assert(eventNames(offerReceipt.logs).includes("EventPassResaleOffered"));
  assert(eventNames(offerReceipt.logs).includes("MintUpAuthorizationUsed"));
  const offered = offerReceipt.logs
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
    .find((entry) => entry?.eventName === "EventPassResaleOffered");
  assert(offered?.eventName === "EventPassResaleOffered");
  assert.equal(offered.args.pass_id, resalePassId);
  assert.equal(offered.args.seller.toLowerCase(), buyer.address.toLowerCase());
  assert.equal(
    offered.args.designated_buyer.toLowerCase(),
    attendee.address.toLowerCase(),
  );
  assert.equal(offered.args.price, RESALE_PRICE);
  assert.deepEqual(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "resaleOffer",
      args: [resalePassId],
    }),
    [buyer.address, attendee.address, RESALE_PRICE, true],
  );
  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "cancelResaleOffer",
      args: [
        resalePassId,
        11n,
        offerIssuedAt,
        offerDeadline,
        27,
        toHex(0, { size: 32 }),
        toHex(0, { size: 32 }),
      ],
    }),
    INVALID_AUTHORIZATION,
  );
  const cancelSignature = await signAuthorization({
    operation: cancelResaleOfferOperation,
    caller: buyer.address,
    passId: resalePassId,
    recipient: "0x0000000000000000000000000000000000000000",
    amount: 0n,
    nonce: 11n,
    issuedAt: offerIssuedAt,
    deadline: offerDeadline,
  });
  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "cancelResaleOffer",
    args: [
      resalePassId,
      11n,
      offerIssuedAt,
      offerDeadline,
      cancelSignature.v,
      cancelSignature.r,
      cancelSignature.s,
    ],
  });
  const cancelOfferReceipt = await publicClient.waitForTransactionReceipt({
    hash,
  });
  assert(
    eventNames(cancelOfferReceipt.logs).includes(
      "EventPassResaleOfferCancelled",
    ),
  );
  assert(
    eventNames(cancelOfferReceipt.logs).includes("MintUpAuthorizationUsed"),
  );
  const replacementSignature = await signAuthorization({
    operation: createResaleOfferOperation,
    caller: buyer.address,
    passId: resalePassId,
    recipient: attendee.address,
    amount: RESALE_PRICE,
    nonce: 12n,
    issuedAt: offerIssuedAt,
    deadline: offerDeadline,
  });
  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "createResaleOffer",
    args: [
      resalePassId,
      attendee.address,
      RESALE_PRICE,
      12n,
      offerIssuedAt,
      offerDeadline,
      replacementSignature.v,
      replacementSignature.r,
      replacementSignature.s,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  await expectMintUpError(
    publicClient.simulateContract({
      account: admin,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "purchaseResale",
      args: [
        resalePassId,
        13n,
        offerIssuedAt,
        offerDeadline,
        27,
        toHex(0, { size: 32 }),
        toHex(0, { size: 32 }),
      ],
    }),
    NOT_DESIGNATED_BUYER,
  );
  hash = await attendeeWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "approve",
    args: [eventPass, RESALE_PRICE],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  hash = await adminWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "setReentry",
    args: [
      eventPass,
      encodeFunctionData({
        abi: eventPassAbi,
        functionName: "purchaseResale",
        args: [
          resalePassId,
          13n,
          offerIssuedAt,
          offerDeadline,
          27,
          toHex(0, { size: 32 }),
          toHex(0, { size: 32 }),
        ],
      }),
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  const resaleFee = (RESALE_PRICE * 900n) / 10_000n;
  const sellerAmount = RESALE_PRICE - resaleFee;
  const sellerBalanceBeforeResale = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [buyer.address],
  });
  const feeBalanceBeforeResale = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [feeRecipient],
  });
  await expectMintUpError(
    publicClient.simulateContract({
      account: attendee,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "purchaseResale",
      args: [
        resalePassId,
        13n,
        offerIssuedAt,
        offerDeadline,
        27,
        toHex(0, { size: 32 }),
        toHex(0, { size: 32 }),
      ],
    }),
    INVALID_AUTHORIZATION,
  );
  const purchaseSignature = await signAuthorization({
    operation: purchaseResaleOperation,
    caller: attendee.address,
    passId: resalePassId,
    recipient: buyer.address,
    amount: RESALE_PRICE,
    nonce: 13n,
    issuedAt: offerIssuedAt,
    deadline: offerDeadline,
  });
  hash = await attendeeWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "purchaseResale",
    args: [
      resalePassId,
      13n,
      offerIssuedAt,
      offerDeadline,
      purchaseSignature.v,
      purchaseSignature.r,
      purchaseSignature.s,
    ],
    gas: 2_000_000n,
  });
  const resaleReceipt = await publicClient.waitForTransactionReceipt({ hash });
  assert(eventNames(resaleReceipt.logs).includes("EventPassResold"));
  assert(eventNames(resaleReceipt.logs).includes("EventPassTransferred"));
  assert(eventNames(resaleReceipt.logs).includes("Transfer"));
  assert(eventNames(resaleReceipt.logs).includes("MintUpAuthorizationUsed"));
  const resold = resaleReceipt.logs
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
    .find((entry) => entry?.eventName === "EventPassResold");
  assert(resold?.eventName === "EventPassResold");
  assert.equal(resold.args.pass_id, resalePassId);
  assert.equal(resold.args.seller.toLowerCase(), buyer.address.toLowerCase());
  assert.equal(resold.args.buyer.toLowerCase(), attendee.address.toLowerCase());
  assert.equal(resold.args.price, RESALE_PRICE);
  assert.equal(resold.args.seller_amount, sellerAmount);
  assert.equal(resold.args.fee_amount, resaleFee);
  const resaleTransferred = resaleReceipt.logs
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
    .find((entry) => entry?.eventName === "EventPassTransferred");
  assert(resaleTransferred?.eventName === "EventPassTransferred");
  assert.equal(resaleTransferred.args.pass_id, resalePassId);
  assert.equal(
    resaleTransferred.args.previous_owner.toLowerCase(),
    buyer.address.toLowerCase(),
  );
  assert.equal(
    resaleTransferred.args.new_owner.toLowerCase(),
    attendee.address.toLowerCase(),
  );
  assert.equal(resaleTransferred.args.event_id, resaleEventId);
  const resaleTransfer = resaleReceipt.logs
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
    .find((entry) => entry?.eventName === "Transfer");
  assert(resaleTransfer?.eventName === "Transfer");
  assert.equal(
    resaleTransfer.args.from.toLowerCase(),
    buyer.address.toLowerCase(),
  );
  assert.equal(
    resaleTransfer.args.to.toLowerCase(),
    attendee.address.toLowerCase(),
  );
  assert.equal(resaleTransfer.args.token_id, resalePassId);
  const resaleAuthorization = resaleReceipt.logs
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
    .find((entry) => entry?.eventName === "MintUpAuthorizationUsed");
  assert(resaleAuthorization?.eventName === "MintUpAuthorizationUsed");
  assert.equal(resaleAuthorization.args.operation, purchaseResaleOperation);
  assert.equal(
    resaleAuthorization.args.caller.toLowerCase(),
    attendee.address.toLowerCase(),
  );
  assert.equal(resaleAuthorization.args.nonce, 13n);
  assert.equal(resaleAuthorization.args.pass_id, resalePassId);
  assert.equal(
    resaleAuthorization.args.recipient.toLowerCase(),
    buyer.address.toLowerCase(),
  );
  assert.equal(resaleAuthorization.args.amount, RESALE_PRICE);
  assert.equal(
    await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "reentryAttempted",
    }),
    true,
  );
  assert.equal(
    await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "reentrySucceeded",
    }),
    false,
  );
  assert.equal(
    (
      await publicClient.readContract({
        address: eventPass,
        abi: eventPassAbi,
        functionName: "ownerOf",
        args: [resalePassId],
      })
    ).toLowerCase(),
    attendee.address.toLowerCase(),
  );
  assert.equal(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "balanceOf",
      args: [buyer.address],
    }),
    1n,
  );
  assert.equal(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "balanceOf",
      args: [attendee.address],
    }),
    1n,
  );
  assert.equal(
    (await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [buyer.address],
    })) - sellerBalanceBeforeResale,
    sellerAmount,
  );
  assert.equal(
    (await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [feeRecipient],
    })) - feeBalanceBeforeResale,
    resaleFee,
  );
  assert.deepEqual(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "passRefundInfo",
      args: [resalePassId],
    }),
    [PRICE, false, false],
  );

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
      args: [
        disabledTransferPass.args.pass_id,
        admin.address,
        1n,
        saleStart,
        saleEnd,
        27,
        toHex(0, { size: 32 }),
        toHex(0, { size: 32 }),
      ],
    }),
    TRANSFERS_DISABLED,
  );

  await expectMintUpError(
    publicClient.simulateContract({
      account: attendee,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "transferPass",
      args: [
        passId,
        admin.address,
        2n,
        saleStart,
        saleEnd,
        27,
        toHex(0, { size: 32 }),
        toHex(0, { size: 32 }),
      ],
    }),
    NOT_PASS_OWNER,
  );

  for (const [functionName, args] of [
    ["approve", [operator.address, passId]],
    ["setApprovalForAll", [operator.address, true]],
    ["transferFrom", [buyer.address, ATTENDEE, passId]],
    ["safeTransferFrom", [buyer.address, ATTENDEE, passId]],
    ["safeTransferFrom", [buyer.address, ATTENDEE, passId, "0x"]],
  ] as const) {
    await expectMintUpError(
      publicClient.simulateContract({
        account: buyer,
        address: eventPass,
        abi: eventPassAbi as Abi,
        functionName,
        args,
      }),
      MOVEMENT_RESTRICTED,
    );
  }

  const transferNonce = 3n;
  const transferIssuedAt = (await publicClient.getBlock()).timestamp;
  const transferDeadline = transferIssuedAt + 60n;
  const signature = await signAuthorization({
    operation: transferOperation,
    caller: buyer.address,
    passId,
    recipient: ATTENDEE,
    amount: 0n,
    nonce: transferNonce,
    issuedAt: transferIssuedAt,
    deadline: transferDeadline,
  });

  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "transferPass",
      args: [
        passId,
        admin.address,
        transferNonce,
        transferIssuedAt,
        transferDeadline,
        Number(signature.v),
        signature.r,
        signature.s,
      ],
    }),
    INVALID_AUTHORIZATION,
  );

  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "transferPass",
    args: [
      passId,
      ATTENDEE,
      transferNonce,
      transferIssuedAt,
      transferDeadline,
      Number(signature.v),
      signature.r,
      signature.s,
    ],
  });
  const transferReceipt = await publicClient.waitForTransactionReceipt({
    hash,
  });
  assert(eventNames(transferReceipt.logs).includes("Transfer"));
  assert(eventNames(transferReceipt.logs).includes("EventPassTransferred"));
  assert(eventNames(transferReceipt.logs).includes("MintUpAuthorizationUsed"));
  const transferred = transferReceipt.logs
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
    .find((entry) => entry?.eventName === "EventPassTransferred");
  assert(transferred);
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
  const authorizationUsed = transferReceipt.logs
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
    .find((entry) => entry?.eventName === "MintUpAuthorizationUsed");
  assert(authorizationUsed);
  assert(authorizationUsed.eventName === "MintUpAuthorizationUsed");
  assert.equal(authorizationUsed.args.operation, transferOperation);
  assert.equal(
    authorizationUsed.args.caller.toLowerCase(),
    buyer.address.toLowerCase(),
  );
  assert.equal(authorizationUsed.args.nonce, transferNonce);
  assert.equal(authorizationUsed.args.pass_id, passId);
  assert.equal(
    authorizationUsed.args.recipient.toLowerCase(),
    ATTENDEE.toLowerCase(),
  );
  assert.equal(authorizationUsed.args.amount, 0n);
  assert.equal(
    (
      await publicClient.readContract({
        address: eventPass,
        abi: eventPassAbi,
        functionName: "ownerOf",
        args: [passId],
      })
    ).toLowerCase(),
    attendee.address.toLowerCase(),
  );
  assert.equal(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "balanceOf",
      args: [buyer.address],
    }),
    1n,
  );
  assert.equal(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "balanceOf",
      args: [attendee.address],
    }),
    2n,
  );

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
      args: [
        passId,
        buyer.address,
        4n,
        saleStart,
        saleEnd,
        27,
        toHex(0, { size: 32 }),
        toHex(0, { size: 32 }),
      ],
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

  const buyerBalanceBeforeRefund = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [buyer.address],
  });
  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "claimRefund",
    args: [disabledTransferPass.args.pass_id],
  });
  const refundReceipt = await publicClient.waitForTransactionReceipt({ hash });
  assert(eventNames(refundReceipt.logs).includes("EventPassRefunded"));
  const refunded = refundReceipt.logs
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
    .find((entry) => entry?.eventName === "EventPassRefunded");
  assert(refunded?.eventName === "EventPassRefunded");
  assert.equal(refunded.args.pass_id, disabledTransferPass.args.pass_id);
  assert.equal(refunded.args.event_id, cancelledEventId);
  assert.equal(
    refunded.args.recipient.toLowerCase(),
    buyer.address.toLowerCase(),
  );
  assert.equal(refunded.args.amount, PRICE);
  const buyerBalanceAfterRefund = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [buyer.address],
  });
  assert.equal(buyerBalanceAfterRefund - buyerBalanceBeforeRefund, PRICE);
  assert.deepEqual(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "passRefundInfo",
      args: [disabledTransferPass.args.pass_id],
    }),
    [PRICE, true, false],
  );
  await expectMintUpError(
    publicClient.simulateContract({
      account: buyer,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "claimRefund",
      args: [disabledTransferPass.args.pass_id],
    }),
    REFUND_ALREADY_CLAIMED,
  );
  assert.equal(
    await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [eventPass],
    }),
    PRICE * 2n,
    "Refund must preserve the other Event's protected payment",
  );

  hash = await adminWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "cancelEvent",
    args: [resaleEventId],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  const attendeeBalanceBeforeRefund = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [attendee.address],
  });
  hash = await attendeeWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "claimRefund",
    args: [resalePassId],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  assert.equal(
    (await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [attendee.address],
    })) - attendeeBalanceBeforeRefund,
    PRICE,
    "The resale buyer must receive the original protected price",
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

  const protectedEventBalance = PRICE;
  const feeAmount = (protectedEventBalance * 500n) / 10_000n;
  const revenueAmount = protectedEventBalance - feeAmount;
  const revenueBalanceBefore = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [ATTENDEE],
  });
  const feeBalanceBefore = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [feeRecipient],
  });
  hash = await adminWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "setFailTransferTo",
    args: [feeRecipient],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "releaseFunds",
    args: [eventId],
    gas: 2_000_000n,
  });
  const failedReleaseReceipt = await publicClient.waitForTransactionReceipt({
    hash,
  });
  assert.equal(failedReleaseReceipt.status, "reverted");
  assert.equal(
    await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [ATTENDEE],
    }),
    revenueBalanceBefore,
    "A failed fee transfer must roll back the revenue transfer",
  );
  assert.deepEqual(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "eventProtectionInfo",
      args: [eventId],
    }),
    [saleEnd, protectedEventBalance, false, false],
  );

  hash = await adminWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "setFailTransferTo",
    args: ["0x0000000000000000000000000000000000000000"],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  hash = await adminWallet.writeContract({
    address: usdc,
    abi: usdcAbi,
    functionName: "setReentry",
    args: [
      eventPass,
      encodeFunctionData({
        abi: eventPassAbi,
        functionName: "releaseFunds",
        args: [eventId],
      }),
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  hash = await buyerWallet.writeContract({
    address: eventPass,
    abi: eventPassAbi,
    functionName: "releaseFunds",
    args: [eventId],
  });
  const releaseReceipt = await publicClient.waitForTransactionReceipt({ hash });
  assert(eventNames(releaseReceipt.logs).includes("EventFundsReleased"));
  assert.equal(
    await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "reentryAttempted",
    }),
    true,
  );
  assert.equal(
    await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "reentrySucceeded",
    }),
    false,
  );
  const released = releaseReceipt.logs
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
    .find((entry) => entry?.eventName === "EventFundsReleased");
  assert(released?.eventName === "EventFundsReleased");
  assert.equal(released.args.event_id, eventId);
  assert.equal(
    released.args.revenue_recipient.toLowerCase(),
    ATTENDEE.toLowerCase(),
  );
  assert.equal(
    released.args.fee_recipient.toLowerCase(),
    feeRecipient.toLowerCase(),
  );
  assert.equal(released.args.revenue_amount, revenueAmount);
  assert.equal(released.args.fee_amount, feeAmount);
  assert.equal(
    (await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [ATTENDEE],
    })) - revenueBalanceBefore,
    revenueAmount,
  );
  assert.equal(
    (await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [feeRecipient],
    })) - feeBalanceBefore,
    feeAmount,
  );
  assert.deepEqual(
    await publicClient.readContract({
      address: eventPass,
      abi: eventPassAbi,
      functionName: "eventProtectionInfo",
      args: [eventId],
    }),
    [saleEnd, 0n, false, true],
  );
  assert.equal(
    await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [eventPass],
    }),
    0n,
  );
  await expectMintUpError(
    publicClient.simulateContract({
      account: admin,
      address: eventPass,
      abi: eventPassAbi as Abi,
      functionName: "releaseFunds",
      args: [eventId],
    }),
    FUNDS_ALREADY_RELEASED,
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
