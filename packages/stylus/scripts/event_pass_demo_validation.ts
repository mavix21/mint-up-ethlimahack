import type { Abi, AbiParameter, Address } from "abitype";

type Hash = `0x${string}`;

export type EventPassDemoDeployment = {
  chainId: number;
  contractAddress: Address;
  deploymentBlock: string;
  deploymentTransaction: Hash;
  administrator: Address;
  authorizationSigner: Address;
  feeRecipient: Address;
  usdc: Address;
  primaryFeeBps: number;
  resaleFeeBps: number;
};

type ContractConfig = {
  administrator: Address;
  authorizationSigner: Address;
  feeRecipient: Address;
  usdc: Address;
  primaryFeeBps: number;
  resaleFeeBps: number;
  paused: boolean;
};

type ProductionDeployment = {
  chainId: number;
  contractAddress: string;
  deploymentBlock: string;
  administratorAddress: string | undefined;
  authorizationSignerAddress: string | undefined;
  feeRecipient: string | undefined;
  primaryFeeBps: number | undefined;
  resaleFeeBps: number | undefined;
};

export type EventPassDemoParityInput = {
  expected: EventPassDemoDeployment;
  canonicalAbi: Abi;
  buyer: {
    abi: Abi;
    chainId: number;
    contractAddress: string;
    convexUrl: string;
    usdc: string;
  };
  production: {
    abi: Abi;
    convexUrl: string;
    usdc: string;
    deployment: ProductionDeployment;
  };
  live: {
    chainId: number;
    contractAddress: string;
    deploymentBlock: string;
    deploymentTransaction: string;
    hasCode: boolean;
    config: ContractConfig;
  };
};

function abiParameter(parameter: AbiParameter, eventInput = false): unknown {
  return {
    type: parameter.type,
    name: parameter.name ?? "",
    indexed:
      eventInput && "indexed" in parameter
        ? (parameter.indexed ?? false)
        : eventInput
          ? false
          : undefined,
    components:
      "components" in parameter
        ? parameter.components.map((component) => abiParameter(component))
        : undefined,
  };
}

function abiSignatures(abi: Abi): string[] {
  return abi
    .filter((entry) => entry.type === "function" || entry.type === "event")
    .map((entry) =>
      JSON.stringify({
        type: entry.type,
        name: entry.name,
        stateMutability:
          entry.type === "function" ? entry.stateMutability : undefined,
        anonymous:
          entry.type === "event" ? (entry.anonymous ?? false) : undefined,
        inputs: entry.inputs.map((input) =>
          abiParameter(input, entry.type === "event"),
        ),
        outputs:
          entry.type === "function"
            ? entry.outputs.map((output) => abiParameter(output))
            : undefined,
      }),
    )
    .sort();
}

function abiMismatch(
  label: string,
  actual: Abi,
  expected: Abi,
): string | undefined {
  const actualSignatures = abiSignatures(actual);
  const expectedSignatures = abiSignatures(expected);
  if (JSON.stringify(actualSignatures) === JSON.stringify(expectedSignatures)) {
    return undefined;
  }
  const actualSet = new Set(actualSignatures);
  const expectedSet = new Set(expectedSignatures);
  const missing = expectedSignatures.find((entry) => !actualSet.has(entry));
  const extra = actualSignatures.find((entry) => !expectedSet.has(entry));
  return `${label}.abi does not match canonical functions and events${
    missing ? `; missing ${missing}` : ""
  }${extra ? `; extra ${extra}` : ""}`;
}

function equalAddress(actual: string | undefined, expected: string): boolean {
  return actual?.toLowerCase() === expected.toLowerCase();
}

export function assertEventPassDemoParity(
  input: EventPassDemoParityInput,
): void {
  const failures: string[] = [];
  const { expected } = input;
  const check = (condition: boolean, field: string) => {
    if (!condition) failures.push(field);
  };

  const buyerAbiMismatch = abiMismatch(
    "buyer",
    input.buyer.abi,
    input.canonicalAbi,
  );
  if (buyerAbiMismatch) failures.push(buyerAbiMismatch);
  const productionAbiMismatch = abiMismatch(
    "production",
    input.production.abi,
    input.canonicalAbi,
  );
  if (productionAbiMismatch) failures.push(productionAbiMismatch);

  check(input.buyer.chainId === expected.chainId, "buyer.chainId");
  check(
    equalAddress(input.buyer.contractAddress, expected.contractAddress),
    "buyer.contractAddress",
  );
  check(equalAddress(input.buyer.usdc, expected.usdc), "buyer.usdc");
  check(
    input.buyer.convexUrl === input.production.convexUrl,
    "buyer.production.convexUrl",
  );
  check(equalAddress(input.production.usdc, expected.usdc), "production.usdc");

  const production = input.production.deployment;
  check(production.chainId === expected.chainId, "production.chainId");
  check(
    equalAddress(production.contractAddress, expected.contractAddress),
    "production.contractAddress",
  );
  check(
    production.deploymentBlock === expected.deploymentBlock,
    "production.deploymentBlock",
  );
  check(
    equalAddress(production.administratorAddress, expected.administrator),
    "production.administratorAddress",
  );
  check(
    equalAddress(
      production.authorizationSignerAddress,
      expected.authorizationSigner,
    ),
    "production.authorizationSignerAddress",
  );
  check(
    equalAddress(production.feeRecipient, expected.feeRecipient),
    "production.feeRecipient",
  );
  check(
    production.primaryFeeBps === expected.primaryFeeBps,
    "production.primaryFeeBps",
  );
  check(
    production.resaleFeeBps === expected.resaleFeeBps,
    "production.resaleFeeBps",
  );

  const live = input.live;
  check(live.chainId === expected.chainId, "live.chainId");
  check(live.hasCode, "live.contractCode");
  check(
    equalAddress(live.contractAddress, expected.contractAddress),
    "live.contractAddress",
  );
  check(
    live.deploymentTransaction.toLowerCase() ===
      expected.deploymentTransaction.toLowerCase(),
    "live.deploymentTransaction",
  );
  check(
    live.deploymentBlock === expected.deploymentBlock,
    "live.deploymentBlock",
  );
  check(
    equalAddress(live.config.administrator, expected.administrator),
    "live.config.administrator",
  );
  check(
    equalAddress(live.config.authorizationSigner, expected.authorizationSigner),
    "live.config.authorizationSigner",
  );
  check(
    equalAddress(live.config.feeRecipient, expected.feeRecipient),
    "live.config.feeRecipient",
  );
  check(equalAddress(live.config.usdc, expected.usdc), "live.config.usdc");
  check(
    live.config.primaryFeeBps === expected.primaryFeeBps,
    "live.config.primaryFeeBps",
  );
  check(
    live.config.resaleFeeBps === expected.resaleFeeBps,
    "live.config.resaleFeeBps",
  );
  check(!live.config.paused, "live.config.paused");

  if (failures.length > 0) {
    throw new Error(
      `Event Pass coordinated demo parity failed:\n- ${failures.join("\n- ")}`,
    );
  }
}
