import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { exportStylusAbi } from "./export_abi";
import {
  generateTsContractDefinition,
  loadDeployedContracts,
} from "./utils/contract";

const contractName = "mint-up-event-pass";
const interfaceDirectory = path.resolve("contracts", contractName, "abi");
const interfaceSource = path.join(interfaceDirectory, "IMintUpEventPass.sol");
const checkedInAbi = path.join(interfaceDirectory, "IMintUpEventPass.abi");

async function main() {
  execFileSync(
    "solc",
    [
      "--abi",
      "--pretty-json",
      "--overwrite",
      "-o",
      interfaceDirectory,
      interfaceSource,
    ],
    { stdio: "inherit" },
  );

  await exportStylusAbi(contractName, contractName, true);

  const abi = JSON.parse(
    fs.readFileSync(checkedInAbi, "utf8"),
  ) as readonly unknown[];
  const deployments = loadDeployedContracts() as Record<
    string,
    Record<string, { address: string; txHash: string }>
  >;
  for (const [chainId, contracts] of Object.entries(deployments)) {
    const deployment = contracts[contractName];
    if (!deployment) continue;
    await generateTsContractDefinition(
      abi,
      contractName,
      deployment.address,
      deployment.txHash,
      chainId,
    );
  }
}

main().catch((error) => {
  console.error("Event Pass artifact generation failed:", error);
  process.exit(1);
});
