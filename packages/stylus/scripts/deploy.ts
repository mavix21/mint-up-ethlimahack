import deployStylusContract from "./deploy_contract";
import {
  getDeploymentConfig,
  getRpcUrlFromChain,
  printDeployedAddresses,
} from "./utils/";
import { DeployOptions } from "./utils/type";
import { config as dotenvConfig } from "dotenv";
import * as path from "path";
import * as fs from "fs";

const OFFICIAL_USDC: Record<number, string> = {
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
};

function getEventPassUsdc(chainId: number, deploymentDir: string): string {
  if (process.env["EVENT_PASS_USDC_ADDRESS"]) {
    return process.env["EVENT_PASS_USDC_ADDRESS"]!;
  }
  if (OFFICIAL_USDC[chainId]) return OFFICIAL_USDC[chainId]!;

  const localDepsPath = path.resolve(
    deploymentDir,
    `${chainId}_local-deps.json`,
  );
  if (fs.existsSync(localDepsPath)) {
    const usdc = JSON.parse(fs.readFileSync(localDepsPath, "utf8")).usdc;
    if (typeof usdc === "string") return usdc;
  }

  throw new Error(
    `USDC address not configured for chain ${chainId}. Set EVENT_PASS_USDC_ADDRESS.`,
  );
}

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  dotenvConfig({ path: envPath });
}

/**
 * Define your deployment logic here
 */
export default async function deployScript(deployOptions: DeployOptions) {
  const config = getDeploymentConfig(deployOptions);

  console.log(`📡 Using endpoint: ${getRpcUrlFromChain(config.chain)}`);
  if (config.chain) {
    console.log(`🌐 Network: ${config.chain?.name}`);
    console.log(`🔗 Chain ID: ${config.chain?.id}`);
  }
  console.log(`🔑 Using private key: ${config.privateKey.substring(0, 10)}...`);
  console.log(`📁 Deployment directory: ${config.deploymentDir}`);
  console.log(`\n`);

  if (!config.deployerAddress) {
    throw new Error("Deployer address is not configured");
  }
  const usdc = getEventPassUsdc(config.chain.id, config.deploymentDir);

  // Deploy a contract. Each deployStylusContract() call deploys ONE contract
  // (its own tx + address) and, on success, automatically:
  // 1. saves the address/tx to packages/stylus/deployments/
  // 2. runs 'cargo stylus export-abi' and writes the ABI + address into
  //    packages/nextjs/contracts/deployedContracts.ts (keyed by chainId + name),
  //    so the Next.js frontend picks it up immediately.
  await deployStylusContract({
    contract: "mint-up-event-pass",
    constructorArgs: [config.deployerAddress, usdc, false],
    ...deployOptions,
  });
  // ─── Deploying MULTIPLE contracts ─────────────────────────────────────────
  // 1. Scaffold each new contract: yarn new-module <name>
  //    (creates packages/stylus/contracts/<name>/ and auto-registers it via members=["*"])
  // 2. Add one deployStylusContract() call per contract below. They deploy
  //    sequentially in a single 'yarn deploy', and each is auto-added to
  //    deployedContracts.ts. (Stylus deploys one contract per tx/address — there is
  //    no single-tx multi-deploy; 'at once' means one command, not one transaction.)
  //
  // await deployStylusContract({
  //   contract: "counter",
  //   constructorArgs: ["42", config.deployerAddress!, true],
  //   pass your #[constructor] args in order
  //   ...deployOptions,
  // });
  //
  // Deploy the SAME crate again under a different key using 'name':
  // await deployStylusContract({
  //   contract: "mint-up-event-pass",
  //   name: "mint-up-event-pass-v2",
  //   constructorArgs: [config.deployerAddress!],
  //   ...deployOptions,
  // });

  // Print the deployed addresses
  console.log("\n\n");
  printDeployedAddresses(config.deploymentDir, config.chain.id.toString());
}
