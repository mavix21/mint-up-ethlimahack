import type {
  Hex,
  ResumeUserOperationResult,
  UserOperationStatusResult,
} from "./pimlico-user-operation-api";

export type SponsoredOperationStart = {
  userOperationHash: Hex;
  result: UserOperationStatusResult;
  resumed: boolean;
};

export async function resumeOrCreateSponsoredOperation({
  resume,
  create,
}: {
  resume: () => Promise<ResumeUserOperationResult>;
  create: () => Promise<{ userOperationHash: Hex }>;
}): Promise<SponsoredOperationStart> {
  const existing = await resume();
  if (existing) return { ...existing, resumed: true };

  const created = await create();
  return {
    userOperationHash: created.userOperationHash,
    result: { status: "pending" },
    resumed: false,
  };
}
