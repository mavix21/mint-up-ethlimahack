import { type FunctionReference, anyApi } from "convex/server";
import type {
  PrepareUserOperationResult,
  UserOperationDto,
} from "./pimlico-user-operation-schema";

export type {
  PrepareUserOperationResult,
  UserOperationDto,
} from "./pimlico-user-operation-schema";

export type Hex = `0x${string}`;

export type UserOperationStatusResult =
  | { status: "pending" }
  | {
      status: "included";
      transactionHash: Hex;
      blockNumber: string;
    }
  | {
      status: "rejected" | "reverted" | "failed";
      transactionHash?: Hex;
      blockNumber?: string;
      message?: string;
    };

export type ResumeUserOperationResult = {
  userOperationHash: Hex;
  result: UserOperationStatusResult;
} | null;

export const preparePimlicoUserOperation = anyApi.passkeySponsorshipActions
  .prepare as FunctionReference<
  "action",
  "public",
  | {
      purchaseId: string;
      transferId?: never;
      resaleId?: never;
      resalePurchaseId?: never;
      refundId?: never;
    }
  | {
      purchaseId?: never;
      transferId: string;
      resaleId?: never;
      resalePurchaseId?: never;
      refundId?: never;
    }
  | {
      purchaseId?: never;
      transferId?: never;
      resaleId: string;
      resalePurchaseId?: never;
      refundId?: never;
    }
  | {
      purchaseId?: never;
      transferId?: never;
      resaleId?: never;
      resalePurchaseId: string;
      refundId?: never;
    }
  | {
      purchaseId?: never;
      transferId?: never;
      resaleId?: never;
      resalePurchaseId?: never;
      refundId: string;
    },
  PrepareUserOperationResult
>;

export const submitPimlicoUserOperation = anyApi.passkeySponsorshipActions
  .submit as FunctionReference<
  "action",
  "public",
  {
    preparationId: string;
    signature: Hex;
    operation?: UserOperationDto;
  },
  { userOperationHash: Hex }
>;

export const getPimlicoUserOperationStatus = anyApi.passkeySponsorshipActions
  .status as FunctionReference<
  "action",
  "public",
  { userOperationHash: Hex },
  UserOperationStatusResult
>;

export const resumePimlicoUserOperation = anyApi.passkeySponsorshipActions
  .resume as FunctionReference<
  "action",
  "public",
  Record<string, never>,
  ResumeUserOperationResult
>;

export const getLatestSponsoredOperation = anyApi.passkeySponsorshipPolicy
  .getLatestIncluded as FunctionReference<
  "query",
  "public",
  Record<string, never>,
  {
    userOperationHash: Hex;
    transactionHash: Hex;
    blockNumber: string;
    includedAt: number;
  } | null
>;
