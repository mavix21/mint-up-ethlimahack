import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  Abi,
  Address,
  Hex,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DeploymentConfig } from "../utils/type";
import { getRpcUrlFromChain } from "../utils/network";

interface SolcOutput {
  contracts?: Record<
    string,
    Record<
      string,
      {
        abi: Abi;
        evm: { bytecode: { object: string } };
      }
    >
  >;
  errors?: { severity: string; formattedMessage: string }[];
}

export interface LocalUsdcDeployment {
  address: Address;
  abi: Abi;
  txHash: Hex;
}

function compileMockUsdc(): { abi: Abi; bytecode: Hex } {
  const sourcePath = path.resolve(__dirname, "MockUsdc.sol");
  const input = JSON.stringify({
    language: "Solidity",
    sources: {
      "MockUsdc.sol": { content: fs.readFileSync(sourcePath, "utf8") },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  });
  const stdout = execFileSync("solc", ["--standard-json"], {
    input,
    encoding: "utf8",
  });
  const output = JSON.parse(stdout.slice(stdout.indexOf("{"))) as SolcOutput;
  const errors = output.errors?.filter((error) => error.severity === "error");
  if (errors?.length) {
    throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
  }
  const contract = output.contracts?.["MockUsdc.sol"]?.["MockUsdc"];
  if (!contract?.evm.bytecode.object) {
    throw new Error("solc did not produce MockUsdc bytecode");
  }
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
}

export async function ensureLocalUsdc(
  config: DeploymentConfig,
): Promise<LocalUsdcDeployment> {
  const rpcUrl = getRpcUrlFromChain(config.chain);
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(rpcUrl),
  });
  const dependenciesPath = path.resolve(
    config.deploymentDir,
    `${config.chain.id}_local-deps.json`,
  );
  const dependencies = fs.existsSync(dependenciesPath)
    ? (JSON.parse(fs.readFileSync(dependenciesPath, "utf8")) as Record<
        string,
        string
      >)
    : {};
  const configured =
    process.env["EVENT_PASS_USDC_ADDRESS"] || dependencies["usdc"];
  const compiled = compileMockUsdc();
  if (configured) {
    const address = configured as Address;
    const code = await publicClient.getBytecode({ address });
    if (code && code !== "0x") {
      return {
        address,
        abi: compiled.abi,
        txHash: (dependencies["usdcTxHash"] || `0x${"0".repeat(64)}`) as Hex,
      };
    }
  }

  console.log("🪙 Local USDC missing; deploying MockUsdc...");
  const account = privateKeyToAccount(config.privateKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(rpcUrl),
  });
  const hash = await walletClient.deployContract({
    abi: compiled.abi,
    bytecode: compiled.bytecode,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error("MockUsdc deployment did not return a contract address");
  }

  fs.mkdirSync(config.deploymentDir, { recursive: true });
  dependencies["usdc"] = receipt.contractAddress;
  dependencies["usdcTxHash"] = hash;
  fs.writeFileSync(dependenciesPath, JSON.stringify(dependencies, null, 2));
  console.log(`✅ MockUsdc deployed at ${receipt.contractAddress}`);
  return { address: receipt.contractAddress, abi: compiled.abi, txHash: hash };
}
