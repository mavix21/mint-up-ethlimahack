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
  | { status: "rejected" | "failed"; message?: string };

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
