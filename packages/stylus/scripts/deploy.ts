import deployStylusContract from "./deploy_contract";
import {
  getDeploymentConfig,
  getRpcUrlFromChain,
  generateTsContractDefinition,
  printDeployedAddresses,
} from "./utils/";
import { DeployOptions } from "./utils/type";
import { config as dotenvConfig } from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { arbitrumNitro } from "../../nextjs/utils/scaffold-stylus/supportedChains";
import { ensureLocalUsdc } from "./local/usdc";

function getEventPassUsdc(chainId: number): string {
  if (chainId === arbitrumNitro.id && process.env["EVENT_PASS_USDC_ADDRESS"]) {
    return process.env["EVENT_PASS_USDC_ADDRESS"]!;
  }
  if (chainId === 421614) {
    return "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
  }
  throw new Error(`Event Pass deployment is unsupported on chain ${chainId}`);
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
  const eventPassAdministrator = process.env["EVENT_PASS_ADMINISTRATOR"];
  const eventPassAuthorizationSigner =
    process.env["EVENT_PASS_AUTHORIZATION_SIGNER"];
  const eventPassFeeRecipient = process.env["EVENT_PASS_FEE_RECIPIENT"];

  if (!eventPassAdministrator) {
    throw new Error(
      "EVENT_PASS_ADMINISTRATOR must be set to deploy the Event Pass contract",
    );
  }
  if (!eventPassAuthorizationSigner) {
    throw new Error(
      "EVENT_PASS_AUTHORIZATION_SIGNER must be set to deploy the Event Pass contract",
    );
  }
  if (!eventPassFeeRecipient) {
    throw new Error(
      "EVENT_PASS_FEE_RECIPIENT must be set to deploy the Event Pass contract",
    );
  }

  console.log(`📡 Using endpoint: ${getRpcUrlFromChain(config.chain)}`);
  if (config.chain) {
    console.log(`🌐 Network: ${config.chain?.name}`);
    console.log(`🔗 Chain ID: ${config.chain?.id}`);
  }
  console.log("🔑 Deployment key loaded");
  console.log(`📁 Deployment directory: ${config.deploymentDir}`);
  console.log(`\n`);

  if (!config.deployerAddress) {
    throw new Error("Deployer address is not configured");
  }
  const localUsdc =
    config.chain.id === arbitrumNitro.id
      ? await ensureLocalUsdc(config)
      : undefined;
  const usdc = localUsdc?.address || getEventPassUsdc(config.chain.id);

  // Deploy a contract. Each deployStylusContract() call deploys ONE contract
  // (its own tx + address) and, on success, automatically:
  // 1. saves the address/tx to packages/stylus/deployments/
  // 2. runs 'cargo stylus export-abi' and writes the ABI + address into
  //    packages/nextjs/contracts/deployedContracts.ts (keyed by chainId + name),
  //    so the Next.js frontend picks it up immediately.
  await deployStylusContract({
    contract: "mint-up-event-pass",
    constructorArgs: [
      eventPassAdministrator,
      usdc,
      eventPassAuthorizationSigner,
      eventPassFeeRecipient,
      false,
    ],
    ...deployOptions,
  });
  if (localUsdc) {
    await generateTsContractDefinition(
      localUsdc.abi,
      "mock-usdc",
      localUsdc.address,
      localUsdc.txHash,
      config.chain.id.toString(),
    );
  }
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
