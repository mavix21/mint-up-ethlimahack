"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { Button } from "~~/components/ui/button";
import { createMintUpSiweMessage } from "~~/lib/siwe-message";

type WalletProofButtonProps = {
  intent: "sign-in" | "link";
  origin: string;
  targetChainId: number;
  targetChainName: string;
  callbackUrl?: string;
  linkedAddresses?: string[];
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as T & { message?: string };
  if (!response.ok)
    throw new Error(result.message ?? "Wallet verification failed.");
  return result;
}

export function WalletProofButton({
  intent,
  origin,
  targetChainId,
  targetChainName,
  callbackUrl = "/",
  linkedAddresses = [],
}: WalletProofButtonProps) {
  const router = useRouter();
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const isAlreadyLinked =
    intent === "link" &&
    address !== undefined &&
    linkedAddresses.some(
      linked => linked.toLowerCase() === address.toLowerCase(),
    );

  async function proveWallet() {
    if (!address) return;
    const walletAddress = address as `0x${string}`;
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      if (chainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }

      const challenge: { nonce: string; expiresAt?: number } =
        intent === "sign-in"
          ? await postJson<{ nonce: string; expiresAt?: number }>(
              "/api/auth/siwe/nonce",
              {
                walletAddress,
                chainId: targetChainId,
              },
            )
          : await postJson<{ nonce: string; expiresAt?: number }>(
              "/api/wallet/link",
              {
                action: "challenge",
                address: walletAddress,
                chainId: targetChainId,
              },
            );
      const expirationTime =
        challenge.expiresAt !== undefined
          ? new Date(challenge.expiresAt)
          : new Date(Date.now() + 5 * 60_000);
      const message = createMintUpSiweMessage({
        address: walletAddress,
        chainId: targetChainId,
        nonce: challenge.nonce,
        origin,
        expirationTime,
      });
      const signature = await signMessageAsync({ message });

      if (intent === "sign-in") {
        await postJson("/api/auth/siwe/verify", {
          message,
          signature,
          walletAddress,
          chainId: targetChainId,
        });
        router.replace(callbackUrl);
      } else {
        await postJson("/api/wallet/link", {
          action: "verify",
          address: walletAddress,
          chainId: targetChainId,
          message,
          signature,
        });
        setSuccess(true);
      }
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Wallet verification failed. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <ConnectButton.Custom>
      {({ mounted, openAccountModal, openConnectModal }) => {
        const ready = mounted;
        if (!ready || !isConnected || !address) {
          return (
            <Button
              className="w-full"
              size="lg"
              disabled={!ready}
              onClick={openConnectModal}
            >
              Connect wallet
            </Button>
          );
        }

        return (
          <div>
            {isAlreadyLinked ? (
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={openAccountModal}
              >
                Choose another wallet
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                variant={intent === "link" ? "outline" : "default"}
                disabled={pending}
                onClick={proveWallet}
              >
                {pending
                  ? "Waiting for signature..."
                  : chainId !== targetChainId
                    ? `Switch to ${targetChainName}`
                    : intent === "sign-in"
                      ? "Sign in with wallet"
                      : "Link connected wallet"}
              </Button>
            )}
            <p className="mt-2 break-all text-xs text-base-content/55">
              Connected: {address}
            </p>
            {success ? (
              <p className="mt-3 text-sm font-medium text-success">
                Wallet linked and verified.
              </p>
            ) : null}
            {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
