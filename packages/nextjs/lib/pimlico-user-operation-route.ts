import { z } from "zod";

const MAX_BODY_BYTES = 16_384;
const hex = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/)
  .max(12_000);
const operation = z
  .record(z.string().min(1).max(64), z.string().max(12_000))
  .refine(value => Object.keys(value).length <= 24);

export const submittedOperationSchema = z
  .object({
    preparationId: z.string().min(1).max(200),
    signature: hex,
    operation: operation.optional(),
  })
  .strict();

export const operationStatusSchema = z
  .object({ userOperationHash: hex })
  .strict();

export async function readBoundedJson(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_BODY_BYTES) return { oversized: true } as const;
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES)
    return { oversized: true } as const;
  try {
    return { value: JSON.parse(body) as unknown } as const;
  } catch {
    return { value: null } as const;
  }
}
