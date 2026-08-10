#!/usr/bin/env ts-node

import { execFileSync } from "child_process";
import * as path from "path";

execFileSync("cargo", ["stylus", "build"], {
  cwd: path.resolve(__dirname, "../contracts/mint-up-event-pass"),
  stdio: "inherit",
});
