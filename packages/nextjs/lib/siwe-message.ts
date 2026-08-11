import { createSiweMessage } from "viem/siwe";

type MintUpSiweMessageInput = {
  address: `0x${string}`;
  chainId: number;
  nonce: string;
  origin: string;
  expirationTime: Date;
  issuedAt?: Date;
};

export function createMintUpSiweMessage({
  address,
  chainId,
  nonce,
  origin,
  expirationTime,
  issuedAt,
}: MintUpSiweMessageInput) {
  const site = new URL(origin);
  return createSiweMessage({
    address,
    chainId,
    domain: site.host,
    uri: site.origin,
    nonce,
    version: "1",
    statement: "Verifica esta wallet para Mint Up Passes.",
    expirationTime,
    issuedAt,
  });
}
