"use client";

import { authClient } from "./auth-client";
import type { OpenfortBrowserConfig } from "./openfort-browser-config";
import {
  AccountTypeEnum,
  ChainTypeEnum,
  EmbeddedState,
  Openfort,
  RecoveryMethod,
  ThirdPartyOAuthProvider,
} from "@openfort/openfort-js";
import { createWalletClient, custom, getAddress, type Chain } from "viem";

async function getEncryptionSession(endpoint: string) {
  const { data } = await authClient.getSession();
  if (!data?.session.token)
    throw new Error("Your wallet session expired. Sign in again.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${data.session.token}` },
  });
  const value: unknown = await response.json();
  if (
    !response.ok ||
    !value ||
    typeof value !== "object" ||
    typeof (value as { encryptionSession?: unknown }).encryptionSession !==
      "string"
  ) {
    throw new Error("Wallet recovery could not be authorized. Try again.");
  }
  return (value as { encryptionSession: string }).encryptionSession;
}

export async function createEmbeddedWalletClient({
  address,
  chain,
  rpcUrl,
  config,
}: {
  address: `0x${string}`;
  chain: Chain;
  rpcUrl: string;
  config: OpenfortBrowserConfig;
}) {
  const openfort = new Openfort({
    baseConfiguration: { publishableKey: config.publishableKey },
    shieldConfiguration: {
      shieldPublishableKey: config.shieldPublishableKey,
    },
    thirdPartyAuth: {
      provider: ThirdPartyOAuthProvider.BETTER_AUTH,
      getAccessToken: async () => {
        const { data } = await authClient.getSession();
        return data?.session.token ?? null;
      },
    },
  });
  await openfort.waitForInitialization();
  let account;
  if (
    (await openfort.embeddedWallet.getEmbeddedState()) === EmbeddedState.READY
  ) {
    account = await openfort.embeddedWallet.get();
  } else {
    if (!config.recoveryEndpoint) {
      throw new Error(
        "This embedded wallet needs recovery, but wallet recovery is not configured for this deployment.",
      );
    }
    account = await openfort.embeddedWallet.configure({
      chainId: chain.id,
      chainType: ChainTypeEnum.EVM,
      accountType: AccountTypeEnum.EOA,
      recoveryParams: {
        recoveryMethod: RecoveryMethod.AUTOMATIC,
        encryptionSession: await getEncryptionSession(config.recoveryEndpoint),
      },
    });
  }
  if (getAddress(account.address) !== getAddress(address)) {
    throw new Error(
      "Openfort recovered a different wallet. Purchase was stopped.",
    );
  }
  const provider = await openfort.embeddedWallet.getEthereumProvider({
    feeSponsorship: config.feeSponsorshipId,
    chains: { [chain.id]: rpcUrl },
  });
  const providerChainId = await provider.request({ method: "eth_chainId" });
  if (Number(providerChainId) !== chain.id) {
    throw new Error(`Switch the embedded wallet to ${chain.name}.`);
  }
  return createWalletClient({
    account: getAddress(address),
    chain,
    transport: custom(provider),
  });
}
