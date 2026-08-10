#!/usr/bin/env ts-node

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { EventPassDemoDeployment } from "./event_pass_demo_validation";

const repoRoot = path.resolve(__dirname, "../../..");
const deployment = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "docs/event-pass-demo-deployment.json"),
    "utf8",
  ),
) as EventPassDemoDeployment;
const rpcUrl =
  process.env["RPC_URL_SEPOLIA"] ?? "https://sepolia-rollup.arbitrum.io/rpc";
const nativeVerification = process.env["STYLUS_VERIFY_NATIVE"] === "1";

execFileSync(
  "cargo",
  [
    "stylus",
    "verify",
    ...(nativeVerification ? ["--no-verify", "--skip-clean"] : []),
    `--endpoint=${rpcUrl}`,
    `--deployment-tx=${deployment.deploymentTransaction}`,
  ],
  {
    cwd: path.resolve(__dirname, "../contracts/mint-up-event-pass"),
    stdio: "inherit",
  },
);
