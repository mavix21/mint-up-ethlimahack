"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AccountTypeEnum,
  OpenfortProvider,
  RecoveryMethod,
  ThirdPartyOAuthProvider,
  useOpenfort,
  useUser,
} from "@openfort/react";
import { useEthereumEmbeddedWallet } from "@openfort/react/ethereum";
import { useRouter } from "next/navigation";
import { stringToHex } from "viem";

import { createOpenfortEncryptionSession } from "~~/app/wallet/actions";
import { Button } from "~~/components/ui/button";
import { authClient } from "~~/lib/auth-client";
import { selectOpenfortEoa } from "~~/lib/openfort-wallet";
import { createMintUpSiweMessage } from "~~/lib/siwe-message";

type OpenfortWalletProps = {
  children: ReactNode;
  origin: string;
  publishableKey: string;
  registeredAddress?: `0x${string}`;
  rpcUrl: string;
  shieldPublishableKey: string;
  targetChainId: number;
};

async function postWalletProof(body: Record<string, unknown>) {
  const response = await fetch("/api/wallet/link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as {
    expiresAt?: number;
    message?: string;
    nonce?: string;
  };
  if (!response.ok) {
    throw new Error(result.message ?? "Wallet verification failed.");
  }
  return result;
}

function OpenfortWalletSetup({
  children,
  origin,
  registeredAddress,
  targetChainId,
}: Pick<
  OpenfortWalletProps,
  "children" | "origin" | "registeredAddress" | "targetChainId"
>) {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const { getAccessToken, isAuthenticated, isLoading } = useUser();
  const { updateEmbeddedAccounts } = useOpenfort();
  const wallet = useEthereumEmbeddedWallet();
  const requestedToken = useRef<string | undefined>(undefined);
  const discoveryStarted = useRef(false);
  const activationAddress = useRef<string | undefined>(undefined);
  const registrationAddress = useRef<string | undefined>(undefined);
  const [desiredAddress, setDesiredAddress] = useState<`0x${string}`>();
  const [activatedAddress, setActivatedAddress] = useState<`0x${string}`>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState("Preparing your secure wallet...");

  const sessionToken = session?.session.token;

  useEffect(() => {
    if (!sessionToken || requestedToken.current === sessionToken) return;
    requestedToken.current = sessionToken;
    getAccessToken().catch(cause => {
      setError(
        cause instanceof Error
          ? cause.message
          : "Openfort authentication failed",
      );
    });
  }, [getAccessToken, sessionToken]);

  useEffect(() => {
    if (!isAuthenticated || discoveryStarted.current) return;
    discoveryStarted.current = true;
    setStatus("Looking for your existing wallet...");

    updateEmbeddedAccounts()
      .then(async accounts => {
        const existing = selectOpenfortEoa(accounts ?? [], registeredAddress);
        if (existing) {
          setDesiredAddress(existing.address as `0x${string}`);
          return;
        }
        setStatus("Creating your secure wallet...");
        const created = await wallet.create({
          accountType: AccountTypeEnum.EOA,
          recoveryMethod: RecoveryMethod.AUTOMATIC,
        });
        setDesiredAddress(created.address as `0x${string}`);
      })
      .catch(cause => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Openfort wallet setup failed",
        );
      });
  }, [isAuthenticated, registeredAddress, updateEmbeddedAccounts, wallet]);

  useEffect(() => {
    if (!desiredAddress) return;
    const discovered = wallet.wallets.find(
      candidate =>
        candidate.address.toLowerCase() === desiredAddress.toLowerCase(),
    );
    if (!discovered || activationAddress.current === desiredAddress) return;
    activationAddress.current = desiredAddress;
    setStatus("Recovering your wallet...");
    wallet
      .setActive({
        address: discovered.address,
        recoveryMethod: RecoveryMethod.AUTOMATIC,
      })
      .then(() => setActivatedAddress(discovered.address))
      .catch(cause => {
        activationAddress.current = undefined;
        setError(
          cause instanceof Error
            ? cause.message
            : "Openfort wallet recovery failed",
        );
      });
  }, [desiredAddress, wallet]);

  useEffect(() => {
    if (
      wallet.status !== "connected" ||
      !session ||
      !desiredAddress ||
      activatedAddress?.toLowerCase() !== desiredAddress.toLowerCase()
    ) {
      return;
    }
    if (wallet.address.toLowerCase() !== desiredAddress.toLowerCase()) return;
    if (
      registeredAddress?.toLowerCase() === wallet.address.toLowerCase() ||
      registrationAddress.current === wallet.address
    ) {
      return;
    }
    registrationAddress.current = wallet.address;
    setStatus("Verifying wallet ownership...");

    void (async () => {
      try {
        const challenge = await postWalletProof({
          action: "challenge",
          address: wallet.address,
          chainId: targetChainId,
        });
        if (!challenge.nonce) throw new Error("Wallet challenge was invalid.");
        const message = createMintUpSiweMessage({
          address: wallet.address,
          chainId: targetChainId,
          nonce: challenge.nonce,
          origin,
          expirationTime: new Date(
            challenge.expiresAt ?? Date.now() + 5 * 60_000,
          ),
        });
        const signature = await wallet.provider.request({
          method: "personal_sign",
          params: [stringToHex(message), wallet.address],
        });
        if (typeof signature !== "string") {
          throw new Error("Openfort returned an invalid signature.");
        }
        await postWalletProof({
          action: "verify",
          walletKind: "embedded",
          address: wallet.address,
          chainId: targetChainId,
          message,
          signature,
        });
        setStatus("Wallet ready.");
        router.refresh();
      } catch (cause) {
        registrationAddress.current = undefined;
        setError(
          cause instanceof Error ? cause.message : "Wallet verification failed",
        );
      }
    })();
  }, [
    activatedAddress,
    desiredAddress,
    origin,
    registeredAddress,
    router,
    session,
    targetChainId,
    wallet,
  ]);

  if (registeredAddress) {
    return (
      <>
        {children}
        {error ? (
          <p className="mt-5 text-sm text-destructive">{error}</p>
        ) : null}
      </>
    );
  }

  return (
    <section className="rounded-4xl border border-primary/20 bg-card p-7 shadow-lg sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        Embedded wallet setup
      </p>
      <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">
        Create your Mint Up wallet
      </h2>
      <p className="mt-3 max-w-2xl text-base-content/70">
        Mint Up creates a recoverable Openfort wallet in this browser and asks
        it to sign a one-time ownership proof before registration.
      </p>
      <div className="mt-7 rounded-2xl bg-base-200 p-5">
        <p className="font-medium">
          {isSessionPending
            ? "Checking your session..."
            : !session
              ? "Sign in to create your wallet."
              : isLoading
                ? "Connecting to Openfort..."
                : (error ?? status)}
        </p>
      </div>
      {error ? (
        <Button className="mt-5" onClick={() => window.location.reload()}>
          Try again
        </Button>
      ) : null}
    </section>
  );
}

export function OpenfortWallet({
  children,
  origin,
  publishableKey,
  registeredAddress,
  rpcUrl,
  shieldPublishableKey,
  targetChainId,
}: OpenfortWalletProps) {
  return (
    <OpenfortProvider
      publishableKey={publishableKey}
      thirdPartyAuth={{
        provider: ThirdPartyOAuthProvider.BETTER_AUTH,
        getAccessToken: async () => {
          const result = await authClient.getSession();
          return result.data?.session.token ?? null;
        },
      }}
      walletConfig={{
        shieldPublishableKey,
        connectOnLogin: false,
        ethereum: {
          accountType: AccountTypeEnum.EOA,
          chainId: targetChainId,
          rpcUrls: { [targetChainId]: rpcUrl },
        },
        getEncryptionSession: async ({ accessToken }) =>
          createOpenfortEncryptionSession(accessToken),
      }}
    >
      <OpenfortWalletSetup
        origin={origin}
        registeredAddress={registeredAddress}
        targetChainId={targetChainId}
      >
        {children}
      </OpenfortWalletSetup>
    </OpenfortProvider>
  );
}
