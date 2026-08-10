import { describe, expect, it } from "@jest/globals";
import { parseAbi } from "viem";
import {
  assertEventPassDemoParity,
  type EventPassDemoParityInput,
} from "../event_pass_demo_validation";

const address = {
  administrator: "0x1111111111111111111111111111111111111111",
  authorizationSigner: "0x2222222222222222222222222222222222222222",
  contract: "0x3333333333333333333333333333333333333333",
  feeRecipient: "0x4444444444444444444444444444444444444444",
  usdc: "0x5555555555555555555555555555555555555555",
} as const;

const abi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 indexed token_id)",
  "function config() view returns (address administrator, address usdc, address authorization_signer, address fee_recipient, uint16 primary_fee_bps, uint16 resale_fee_bps, bool paused)",
]);

function validInput(): EventPassDemoParityInput {
  return {
    expected: {
      chainId: 421614,
      contractAddress: address.contract,
      deploymentBlock: "296513974",
      deploymentTransaction:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      administrator: address.administrator,
      authorizationSigner: address.authorizationSigner,
      feeRecipient: address.feeRecipient,
      usdc: address.usdc,
      primaryFeeBps: 500,
      resaleFeeBps: 900,
    },
    canonicalAbi: abi,
    buyer: {
      abi,
      chainId: 421614,
      contractAddress: address.contract,
      convexUrl: "https://shared.convex.cloud",
      usdc: address.usdc,
    },
    production: {
      abi,
      convexUrl: "https://shared.convex.cloud",
      usdc: address.usdc,
      deployment: {
        chainId: 421614,
        contractAddress: address.contract,
        deploymentBlock: "296513974",
        administratorAddress: address.administrator,
        authorizationSignerAddress: address.authorizationSigner,
        feeRecipient: address.feeRecipient,
        primaryFeeBps: 500,
        resaleFeeBps: 900,
      },
    },
    live: {
      chainId: 421614,
      contractAddress: address.contract,
      deploymentBlock: "296513974",
      deploymentTransaction:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      hasCode: true,
      config: {
        administrator: address.administrator,
        authorizationSigner: address.authorizationSigner,
        feeRecipient: address.feeRecipient,
        usdc: address.usdc,
        primaryFeeBps: 500,
        resaleFeeBps: 900,
        paused: false,
      },
    },
  };
}

describe("coordinated Event Pass demo parity", () => {
  it("accepts one matching contract, buyer, and production environment", () => {
    expect(() => assertEventPassDemoParity(validInput())).not.toThrow();
  });

  it("reports every environment mismatch with an actionable field name", () => {
    const input = validInput();
    input.buyer.contractAddress = address.administrator;
    input.production.convexUrl = "https://other.convex.cloud";
    input.production.usdc = address.administrator;
    input.production.deployment.authorizationSignerAddress = undefined;
    input.live.config.resaleFeeBps = 800;

    expect(() => assertEventPassDemoParity(input)).toThrow(
      /buyer\.contractAddress.*convexUrl.*production\.usdc.*authorizationSignerAddress.*live\.config\.resaleFeeBps/s,
    );
  });

  it("rejects function or event drift in the production ABI", () => {
    const input = validInput();
    input.production.abi = parseAbi([
      "event Transfer(address indexed from, address to, uint256 indexed token_id)",
      "function config() view returns (address administrator)",
    ]);

    expect(() => assertEventPassDemoParity(input)).toThrow(
      /production\.abi does not match canonical functions and events/,
    );
  });
});
