import { toKernelSmartAccount } from "permissionless/accounts";
import { createPublicClient, getAddress, http, type Address } from "viem";
import { toWebAuthnAccount } from "viem/account-abstraction";
import { arbitrumSepolia } from "viem/chains";

export type WalletPasskeyAccount = {
  address: Address;
  chainId: 421614;
  credentialId: string;
  publicKey: `0x${string}`;
  rpId: string;
  accountType: "kernel-webauthn";
  kernelVersion: "0.3.1";
  entryPointVersion: "0.7";
  entryPointAddress: Address;
  validatorVersion: "0.0.3";
  validatorAddress: Address;
  accountLogicAddress: Address;
  factoryAddress: Address;
  metaFactoryAddress: Address;
  useMetaFactory: true;
  accountIndex: string;
  nonceKey: string;
  deploymentState: "counterfactual" | "deployed";
  permissionlessVersion: "0.3.7";
  viemVersion: "2.55.11";
  oxVersion: "0.11.3";
  initializationHash: `0x${string}`;
};

export const kernelAccountMatrix = {
  chainId: 421614,
  accountType: "kernel-webauthn",
  kernelVersion: "0.3.1",
  entryPointVersion: "0.7",
  entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  validatorVersion: "0.0.3",
  validatorAddress: "0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69",
  accountLogicAddress: "0xBAC849bB641841b44E965fB01A4Bf5F074f84b4D",
  factoryAddress: "0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419",
  metaFactoryAddress: "0xd703aaE79538628d27099B8c4f621bE4CCd142d5",
  useMetaFactory: true,
  accountIndex: "0",
  nonceKey: "0",
  permissionlessVersion: "0.3.7",
  viemVersion: "2.55.11",
  oxVersion: "0.11.3",
} as const;

type KernelParameters = Parameters<typeof toKernelSmartAccount>[0];

export async function reconstructKernelAccount(
  configuration: WalletPasskeyAccount,
  dependencies: {
    createKernel?: (
      parameters: KernelParameters,
    ) => Promise<{ address: Address }>;
  } = {},
) {
  const reconstructed = await deriveKernelAccount(configuration, dependencies);
  assertReconstructedAddress(configuration.address, reconstructed.address);
  return reconstructed;
}

export async function deriveKernelAccount(
  configuration: Omit<WalletPasskeyAccount, "address">,
  dependencies: {
    createKernel?: (
      parameters: KernelParameters,
    ) => Promise<{ address: Address }>;
  } = {},
) {
  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(),
  });
  const owner = toWebAuthnAccount({
    credential: {
      id: configuration.credentialId,
      publicKey: configuration.publicKey,
    },
    rpId: configuration.rpId,
  });
  const createKernel = dependencies.createKernel ?? toKernelSmartAccount;
  return createKernel({
    client,
    owners: [owner],
    version: configuration.kernelVersion,
    entryPoint: {
      address: configuration.entryPointAddress,
      version: configuration.entryPointVersion,
    },
    validatorAddress: configuration.validatorAddress,
    accountLogicAddress: configuration.accountLogicAddress,
    factoryAddress: configuration.factoryAddress,
    metaFactoryAddress: configuration.metaFactoryAddress,
    useMetaFactory: configuration.useMetaFactory,
    index: BigInt(configuration.accountIndex),
    nonceKey: BigInt(configuration.nonceKey),
  });
}

export function assertReconstructedAddress(
  expected: Address,
  reconstructed: Address,
) {
  if (getAddress(expected) !== getAddress(reconstructed)) {
    throw new Error("deterministic account address mismatch");
  }
}
