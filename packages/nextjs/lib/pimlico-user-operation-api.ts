import { type FunctionReference, anyApi } from "convex/server";

export type Hex = `0x${string}`;

export type UserOperationDto = Record<string, string>;

export type PrepareUserOperationResult = {
  preparationId: string;
  chainId: 421614;
  entryPoint: Hex;
  operation: UserOperationDto;
  expiresAt: number;
};

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
  Record<string, never>,
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
