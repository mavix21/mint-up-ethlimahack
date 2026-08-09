import "server-only";

import { decodeEventLog, erc20Abi, getAddress, parseAbi, type Hex } from "viem";

import { eventPassEnvironment } from "../contracts/eventPassEnvironment";
import { createEventPassPublicClient } from "./event-pass-public-client";
import type { PreparedPurchase } from "./event-pass-purchase-api";

const availabilityAbi = parseAbi([
  "function config() view returns (address administrator, address usdc, address authorization_signer, address fee_recipient, uint16 primary_fee_bps, uint16 resale_fee_bps, bool paused)",
  "function eventInfo(bytes32 event_id) view returns (address revenue_recipient, uint64 price, uint32 maximum_supply, uint32 issued_supply, uint64 sale_start, uint64 sale_end, bool sales_enabled, bool transfers_enabled, bool cancelled, address check_in_operator)",
]);

const eventPassPurchaseAbi = parseAbi([
  "function passInfo(uint64 pass_id) view returns (address owner, bytes32 event_id, uint8 state, bool valid_for_check_in)",
  "event EventPassPurchased(uint64 indexed pass_id, bytes32 indexed event_id, address indexed buyer)",
]);

const entryPointAbi = parseAbi([
  "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)",
]);

export type EventPassPurchaseSnapshot = PreparedPurchase & {
  transactionHash: Hex;
  userOperationHash: Hex;
};

export type EventPassPurchaseVerification = {
  transactionHash: Hex;
  transactionLogIndex: number;
  passId: string;
};

export async function verifyPreparedPurchaseAvailability(
  purchase: PreparedPurchase,
) {
  if (
    purchase.chainId !== eventPassEnvironment.chainId ||
    getAddress(purchase.contractAddress) !==
      getAddress(eventPassEnvironment.eventPassAddress) ||
    getAddress(purchase.paymentAssetAddress) !==
      getAddress(eventPassEnvironment.usdcAddress)
  ) {
    throw new Error("Prepared purchase uses an unsupported network");
  }
  const client = createEventPassPublicClient(purchase.chainId);
  const [config, event, block] = await Promise.all([
    client.readContract({
      address: purchase.contractAddress,
      abi: availabilityAbi,
      functionName: "config",
    }),
    client.readContract({
      address: purchase.contractAddress,
      abi: availabilityAbi,
      functionName: "eventInfo",
      args: [purchase.eventIdentifier as `0x${string}`],
    }),
    client.getBlock(),
  ]);
  const [, usdc, , , , , paused] = config;
  const [
    revenueRecipient,
    price,
    maximumSupply,
    issuedSupply,
    saleStart,
    saleEnd,
    salesEnabled,
    ,
    cancelled,
  ] = event;
  if (
    getAddress(usdc) !== getAddress(purchase.paymentAssetAddress) ||
    getAddress(revenueRecipient) !== getAddress(purchase.revenueRecipient) ||
    price !== BigInt(purchase.priceAmountSubunits) ||
    paused ||
    !salesEnabled ||
    cancelled ||
    issuedSupply >= maximumSupply ||
    block.timestamp < saleStart ||
    block.timestamp >= saleEnd
  ) {
    throw new Error("Prepared purchase is no longer available onchain");
  }
}

export async function verifyEventPassPurchase(
  snapshot: EventPassPurchaseSnapshot,
): Promise<EventPassPurchaseVerification> {
  const client = createEventPassPublicClient(snapshot.chainId);
  const hash = snapshot.transactionHash as Hex;
  const receipt = await client.getTransactionReceipt({ hash });
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const contractAddress = getAddress(snapshot.contractAddress);
  const buyerAddress = getAddress(snapshot.buyerAddress);
  const paymentAssetAddress = getAddress(snapshot.paymentAssetAddress);

  if (receipt.status !== "success") {
    throw new Error("Purchase transaction failed");
  }

  if (!snapshot.userOperationHash) {
    throw new Error(
      "ERC-4337 UserOperation is required for purchase verification",
    );
  }
  if (!snapshot.entryPointAddress) {
    throw new Error("Prepared EntryPoint is missing");
  }
  const entryPointAddress = getAddress(snapshot.entryPointAddress);
  const matchingOperations = receipt.logs.flatMap(log => {
    if (log.address.toLowerCase() !== entryPointAddress.toLowerCase())
      return [];
    try {
      const decoded = decodeEventLog({
        abi: entryPointAbi,
        eventName: "UserOperationEvent",
        data: log.data,
        topics: log.topics,
        strict: true,
      });
      return decoded.args.userOpHash.toLowerCase() ===
        snapshot.userOperationHash?.toLowerCase()
        ? [decoded.args]
        : [];
    } catch {
      return [];
    }
  });
  if (
    matchingOperations.length !== 1 ||
    matchingOperations[0]?.sender.toLowerCase() !==
      buyerAddress.toLowerCase() ||
    matchingOperations[0]?.success !== true
  ) {
    throw new Error("EntryPoint UserOperationEvent is invalid");
  }

  if (block.timestamp * BigInt(1_000) >= BigInt(snapshot.expiresAt)) {
    throw new Error(
      "Purchase transaction was submitted after preparation expired",
    );
  }

  const purchased = receipt.logs.flatMap(log => {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) return [];
    try {
      const decoded = decodeEventLog({
        abi: eventPassPurchaseAbi,
        eventName: "EventPassPurchased",
        data: log.data,
        topics: log.topics,
      });
      return [{ decoded, logIndex: log.logIndex }];
    } catch {
      return [];
    }
  });
  if (purchased.length !== 1) {
    throw new Error("Purchase transaction must issue exactly one Event Pass");
  }
  const [{ decoded, logIndex }] = purchased;
  if (
    decoded.args.event_id.toLowerCase() !==
      snapshot.eventIdentifier.toLowerCase() ||
    decoded.args.buyer.toLowerCase() !== buyerAddress.toLowerCase()
  ) {
    throw new Error(
      "Event Pass purchase event does not match the prepared purchase",
    );
  }

  const protectedPayment = receipt.logs.some(log => {
    if (log.address.toLowerCase() !== paymentAssetAddress.toLowerCase())
      return false;
    try {
      const decodedTransfer = decodeEventLog({
        abi: erc20Abi,
        eventName: "Transfer",
        data: log.data,
        topics: log.topics,
      });
      return (
        decodedTransfer.args.from.toLowerCase() ===
          buyerAddress.toLowerCase() &&
        decodedTransfer.args.to.toLowerCase() ===
          contractAddress.toLowerCase() &&
        decodedTransfer.args.value === BigInt(snapshot.priceAmountSubunits)
      );
    } catch {
      return false;
    }
  });
  if (!protectedPayment) {
    throw new Error("Protected USDC payment could not be verified");
  }

  const passId = decoded.args.pass_id;
  const [owner, eventId, state, valid] = await client.readContract({
    address: contractAddress,
    abi: eventPassPurchaseAbi,
    functionName: "passInfo",
    args: [passId],
    blockNumber: receipt.blockNumber,
  });
  if (
    owner.toLowerCase() !== buyerAddress.toLowerCase() ||
    eventId.toLowerCase() !== snapshot.eventIdentifier.toLowerCase() ||
    state !== 1 ||
    !valid
  ) {
    throw new Error("Confirmed Event Pass ownership is invalid");
  }
  return {
    transactionHash: hash,
    transactionLogIndex: logIndex,
    passId: passId.toString(),
  };
}
