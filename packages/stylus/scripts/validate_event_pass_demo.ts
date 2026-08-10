#!/usr/bin/env ts-node

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { parse } from "dotenv";
import { parseAbi, type Abi, type Address } from "abitype";
import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";
import {
  assertEventPassDemoParity,
  type EventPassDemoDeployment,
} from "./event_pass_demo_validation";

type ConvexDeployment = {
  chainId: number;
  contractAddress: string;
  deploymentBlock: string;
  administratorAddress?: string;
  authorizationSignerAddress?: string;
  feeRecipient?: string;
  primaryFeeBps?: number;
  resaleFeeBps?: number;
};

const repoRoot = path.resolve(__dirname, "../../..");
const STYLUS_ACTIVATION_PRECOMPILE =
  "0x0000000000000000000000000000000000000071";
const STYLUS_ACTIVATED_TOPIC =
  "0xc0e812780707128d9a180db8ee4d1c1f1300b6dd0626d577b5d9ac759b76253c";

// Keep the generated frontend module out of this package's TypeScript graph.
/* eslint-disable @typescript-eslint/no-var-requires */
const deployedContracts = (
  require("../../nextjs/contracts/deployedContracts") as {
    default: Record<string, Record<string, { abi: Abi; address: Address }>>;
  }
).default;
/* eslint-enable @typescript-eslint/no-var-requires */

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function readEnv(file: string): Record<string, string> {
  if (!fs.existsSync(file))
    throw new Error(`Environment file not found: ${file}`);
  return parse(fs.readFileSync(file));
}

function readProductionAbi(productionRoot: string): Abi {
  const source = fs.readFileSync(
    path.join(productionRoot, "packages/backend/convex/lib/eventPassAbi.ts"),
    "utf8",
  );
  const declarations = Array.from(
    source.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/gm),
    (match) => JSON.parse(match[1]!) as string,
  );
  if (declarations.length === 0) {
    throw new Error("Production Event Pass ABI declarations were not found");
  }
  return parseAbi(declarations);
}

function configuredUsdc(file: string, owner: string): string {
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(
    /(?:const|export const) ARBITRUM_SEPOLIA_USDC\s*=\s*["'](0x[0-9a-fA-F]{40})["']/,
  );
  if (!match?.[1]) {
    throw new Error(`${owner} Arbitrum Sepolia USDC was not found`);
  }
  return match[1];
}

function readConvexDeployment(
  productionRoot: string,
  deploymentName: string | undefined,
  chainId: number,
): ConvexDeployment {
  const args = [
    "exec",
    "convex",
    "data",
    "eventPassDeployments",
    "--limit",
    "100",
    "--format",
    "json",
  ];
  if (deploymentName) args.push("--deployment", deploymentName);
  const output = execFileSync("pnpm", args, {
    cwd: path.join(productionRoot, "packages/backend"),
    encoding: "utf8",
  });
  const deployments = JSON.parse(output) as ConvexDeployment[];
  const deployment = deployments.find((entry) => entry.chainId === chainId);
  if (!deployment) {
    throw new Error(`Convex has no Event Pass deployment for chain ${chainId}`);
  }
  return deployment;
}

async function main(): Promise<void> {
  const productionRoot = path.resolve(
    required(
      option("production-root") ?? process.env["MINT_UP_PROD_ROOT"],
      "Set MINT_UP_PROD_ROOT or pass --production-root",
    ),
  );
  const expected = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "docs/event-pass-demo-deployment.json"),
      "utf8",
    ),
  ) as EventPassDemoDeployment;
  const canonicalAbi = JSON.parse(
    fs.readFileSync(
      path.join(
        repoRoot,
        "packages/stylus/contracts/mint-up-event-pass/abi/IMintUpEventPass.abi",
      ),
      "utf8",
    ),
  ) as Abi;
  const buyerEnv = readEnv(path.join(repoRoot, "packages/nextjs/.env"));
  const productionEnv = readEnv(
    path.join(productionRoot, "packages/backend/.env.local"),
  );
  const convexDeployment = readConvexDeployment(
    productionRoot,
    option("convex-deployment"),
    expected.chainId,
  );
  const rpcUrl = option("rpc-url") ?? "https://sepolia-rollup.arbitrum.io/rpc";
  const provider = new JsonRpcProvider(rpcUrl);
  const receipt = await provider.getTransactionReceipt(
    expected.deploymentTransaction,
  );
  if (!receipt)
    throw new Error("Live Event Pass deployment receipt was not found");
  if (receipt.status !== 1) {
    throw new Error(
      "Live Event Pass deployment transaction was not successful",
    );
  }
  const deployedAddress = expected.contractAddress.slice(2).toLowerCase();
  const activationLog = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === STYLUS_ACTIVATION_PRECOMPILE &&
      log.topics[0]?.toLowerCase() === STYLUS_ACTIVATED_TOPIC,
  );
  const activationWords = activationLog?.data.slice(2).match(/.{64}/g);
  const activatedAddress = activationWords?.[1]?.slice(24).toLowerCase();
  if (activatedAddress !== deployedAddress) {
    throw new Error(
      "Live deployment receipt does not activate the expected Event Pass address",
    );
  }
  const code = await provider.getCode(expected.contractAddress);
  const contract = new Contract(
    expected.contractAddress,
    canonicalAbi as unknown as InterfaceAbi,
    provider,
  );
  const configFunction = contract["config"];
  if (!configFunction) throw new Error("Live Event Pass config is unavailable");
  const config = (await configFunction()) as unknown;
  if (!Array.isArray(config) || config.length !== 7) {
    throw new Error("Live Event Pass config returned an unexpected shape");
  }
  const buyerContract = deployedContracts["421614"]?.["mint-up-event-pass"];
  if (!buyerContract) {
    throw new Error(
      "Buyer Event Pass deployment is not generated for chain 421614",
    );
  }
  const buyerEnvironment = required(
    buyerEnv["NEXT_PUBLIC_EVENT_PASS_ENVIRONMENT"],
    "Buyer Event Pass environment is not configured",
  );
  if (buyerEnvironment !== "sepolia") {
    throw new Error(
      `Buyer Event Pass environment must be sepolia, got ${buyerEnvironment}`,
    );
  }

  assertEventPassDemoParity({
    expected,
    canonicalAbi,
    buyer: {
      abi: buyerContract.abi,
      chainId: 421614,
      contractAddress: required(
        buyerEnv["NEXT_PUBLIC_ARBITRUM_SEPOLIA_EVENT_PASS"],
        "Buyer Event Pass address is not configured",
      ),
      convexUrl: required(
        buyerEnv["NEXT_PUBLIC_CONVEX_URL"],
        "Buyer Convex URL is not configured",
      ),
      usdc: configuredUsdc(
        path.join(
          repoRoot,
          "packages/nextjs/contracts/eventPassEnvironment.ts",
        ),
        "Buyer",
      ),
    },
    production: {
      abi: readProductionAbi(productionRoot),
      convexUrl: required(
        productionEnv["CONVEX_URL"],
        "Production Convex URL is not configured",
      ),
      usdc: configuredUsdc(
        path.join(productionRoot, "packages/backend/convex/eventPasses.ts"),
        "Production",
      ),
      deployment: {
        ...convexDeployment,
        administratorAddress: convexDeployment.administratorAddress,
        authorizationSignerAddress: convexDeployment.authorizationSignerAddress,
        feeRecipient: convexDeployment.feeRecipient,
        primaryFeeBps: convexDeployment.primaryFeeBps,
        resaleFeeBps: convexDeployment.resaleFeeBps,
      },
    },
    live: {
      chainId: Number((await provider.getNetwork()).chainId),
      contractAddress: expected.contractAddress,
      deploymentBlock: receipt.blockNumber.toString(),
      deploymentTransaction: receipt.hash,
      hasCode: code !== "0x",
      config: {
        administrator: config[0] as Address,
        usdc: config[1] as Address,
        authorizationSigner: config[2] as Address,
        feeRecipient: config[3] as Address,
        primaryFeeBps: Number(config[4]),
        resaleFeeBps: Number(config[5]),
        paused: config[6] as boolean,
      },
    },
  });

  const buyerRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const productionRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: productionRoot,
    encoding: "utf8",
  }).trim();
  console.log("Event Pass coordinated demo parity passed");
  console.log(`Buyer revision: ${buyerRevision}`);
  console.log(`Production revision: ${productionRevision}`);
  console.log(`Chain: ${expected.chainId}`);
  console.log(`Contract: ${expected.contractAddress}`);
  console.log(`Deployment transaction: ${receipt.hash}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
