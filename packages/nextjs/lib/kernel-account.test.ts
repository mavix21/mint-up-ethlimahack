import { describe, expect, it, vi } from "vitest";

import {
  assertReconstructedAddress,
  reconstructKernelAccount,
  type WalletPasskeyAccount,
} from "./kernel-account";

const account: WalletPasskeyAccount = {
  address: "0x1111111111111111111111111111111111111111",
  chainId: 421614,
  credentialId: "AQID",
  publicKey: ("0x04" + "11".repeat(64)) as `0x${string}`,
  rpId: "passes.mint-up.xyz",
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
  deploymentState: "counterfactual",
  permissionlessVersion: "0.3.7",
  viemVersion: "2.55.11",
  oxVersion: "0.11.3",
  initializationHash: ("0x" + "22".repeat(32)) as `0x${string}`,
};

describe("Kernel account reconstruction", () => {
  it("uses every persisted deterministic parameter rather than SDK defaults", async () => {
    const createKernel = vi.fn(async () => ({ address: account.address }));

    await reconstructKernelAccount(account, { createKernel });

    expect(createKernel).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "0.3.1",
        entryPoint: {
          address: account.entryPointAddress,
          version: "0.7",
        },
        validatorAddress: account.validatorAddress,
        accountLogicAddress: account.accountLogicAddress,
        factoryAddress: account.factoryAddress,
        metaFactoryAddress: account.metaFactoryAddress,
        useMetaFactory: true,
        index: 0n,
        nonceKey: 0n,
      }),
    );
  });

  it("rejects a browser reconstruction that differs from the stored address", () => {
    expect(() =>
      assertReconstructedAddress(
        account.address,
        "0x2222222222222222222222222222222222222222",
      ),
    ).toThrow("deterministic account address mismatch");
  });
});
