export type WalletOption =
  | {
      id: string;
      kind: "embedded";
      address: `0x${string}`;
    }
  | {
      id: string;
      kind: "linked";
      address: `0x${string}`;
      chainId: number;
    };

type LinkedWalletProjection = { address: string; chainId: number };

function verifiedAddress(address: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Invalid verified wallet projection");
  }
  return address as `0x${string}`;
}

export function createWalletOptions(
  embeddedAddress: string | undefined,
  linkedWallets: LinkedWalletProjection[],
): WalletOption[] {
  const embedded = embeddedAddress
    ? verifiedAddress(embeddedAddress)
    : undefined;
  return [
    ...(embedded
      ? [
          {
            id: `embedded:${embedded}`,
            kind: "embedded" as const,
            address: embedded,
          },
        ]
      : []),
    ...linkedWallets.map(wallet => {
      const address = verifiedAddress(wallet.address);
      if (!Number.isSafeInteger(wallet.chainId) || wallet.chainId <= 0) {
        throw new Error("Invalid verified wallet projection");
      }
      return {
        id: `linked:${wallet.chainId}:${address}`,
        kind: "linked" as const,
        address,
        chainId: wallet.chainId,
      };
    }),
  ];
}
