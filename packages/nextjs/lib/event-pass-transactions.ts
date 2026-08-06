import { decodeEventLog, parseAbi, type TransactionReceipt } from "viem";

export const eventPassPurchaseAbi = parseAbi([
  "function purchase(bytes32 event_id) returns (uint64 pass_id)",
  "event EventPassPurchased(uint64 indexed pass_id, bytes32 indexed event_id, address indexed buyer)",
]);

export function canFundPurchase(balance: bigint, price: bigint) {
  return balance >= price;
}

export function approvalRequired(allowance: bigint, price: bigint) {
  return allowance < price;
}

export function assertApprovalConfirmed({
  receiptStatus,
  cancelled,
  allowance,
  price,
}: {
  receiptStatus: "success" | "reverted";
  cancelled: boolean;
  allowance: bigint;
  price: bigint;
}) {
  if (receiptStatus !== "success" || cancelled || allowance < price) {
    throw new Error("USDC approval failed. No Event Pass was purchased.");
  }
}

export function purchasedPassFromReceipt(
  receipt: TransactionReceipt,
  contractAddress: `0x${string}`,
  eventIdentifier: `0x${string}`,
  buyerAddress: `0x${string}`,
) {
  if (receipt.status !== "success") {
    throw new Error("The purchase transaction failed.");
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
      return [decoded.args];
    } catch {
      return [];
    }
  });
  if (purchased.length !== 1) {
    throw new Error("The transaction did not issue exactly one Event Pass.");
  }
  const [event] = purchased;
  if (
    event.event_id.toLowerCase() !== eventIdentifier.toLowerCase() ||
    event.buyer.toLowerCase() !== buyerAddress.toLowerCase()
  ) {
    throw new Error(
      "The issued Event Pass does not belong to the selected wallet.",
    );
  }
  return {
    passId: event.pass_id.toString(),
    transactionHash: receipt.transactionHash,
  };
}
