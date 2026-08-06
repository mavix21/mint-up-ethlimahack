import deployedContracts from "./deployedContracts";

const ARBITRUM_SEPOLIA_USDC =
  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as const;
const ARBITRUM_SEPOLIA_EVENT_PASS =
  process.env["NEXT_PUBLIC_ARBITRUM_SEPOLIA_EVENT_PASS"];

type EventPassEnvironmentInput = {
  environment: string;
  eventPassAddress?: string | undefined;
};

export type EventPassEnvironment = {
  name: "local" | "sepolia";
  chainId: 412346 | 421614;
  eventPassAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
};

function requireAddress(value: string | undefined, variable: string) {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${variable} must be a valid EVM address`);
  }
  return value as `0x${string}`;
}

export function resolveEventPassEnvironment({
  environment,
  eventPassAddress,
}: EventPassEnvironmentInput): EventPassEnvironment {
  if (environment === "local") {
    const contracts = deployedContracts["412346"];
    return {
      name: "local",
      chainId: 412346,
      eventPassAddress: contracts["mint-up-event-pass"].address,
      usdcAddress: contracts["mock-usdc"].address,
    };
  }

  if (environment === "sepolia") {
    return {
      name: "sepolia",
      chainId: 421614,
      eventPassAddress: requireAddress(
        eventPassAddress ?? ARBITRUM_SEPOLIA_EVENT_PASS,
        "Arbitrum Sepolia Event Pass address",
      ),
      usdcAddress: ARBITRUM_SEPOLIA_USDC,
    };
  }

  throw new Error(`Unsupported Event Pass environment: ${environment}`);
}

export const eventPassEnvironment = resolveEventPassEnvironment({
  environment: process.env["NEXT_PUBLIC_EVENT_PASS_ENVIRONMENT"] ?? "local",
});

export const eventPassChainName =
  eventPassEnvironment.name === "local" ? "Nitro DevNode" : "Arbitrum Sepolia";
