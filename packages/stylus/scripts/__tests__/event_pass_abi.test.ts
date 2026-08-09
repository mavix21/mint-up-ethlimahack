import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "@jest/globals";
import deployedContracts from "../../../nextjs/contracts/deployedContracts";
import generatedStylusAbi from "../generated/mint-up-event-pass";

type AbiEntry = {
  anonymous?: boolean;
  inputs?: readonly AbiParameter[];
  name?: string;
  outputs?: readonly AbiParameter[];
  stateMutability?: string;
  type: string;
};

type AbiParameter = {
  indexed?: boolean;
  name?: string;
  type: string;
};

function signature(entry: AbiEntry, includeMetadataNames: boolean): string {
  const parameters = (
    values: readonly AbiParameter[] | undefined,
    includeNames: boolean,
  ) =>
    (values ?? [])
      .map(
        ({ indexed, name, type }) =>
          `${type}:${includeNames ? (name ?? "") : ""}:${indexed === undefined ? "" : indexed}`,
      )
      .join(",");

  return [
    entry.type,
    entry.name ?? "",
    entry.stateMutability ?? "",
    entry.anonymous ?? "",
    parameters(
      entry.inputs,
      entry.type === "event" ||
        (entry.type === "function" && includeMetadataNames),
    ),
    parameters(entry.outputs, includeMetadataNames),
  ].join("|");
}

function signatures(
  abi: readonly AbiEntry[],
  types: readonly string[],
  includeMetadataNames: boolean,
) {
  return abi
    .filter((entry) => types.includes(entry.type))
    .map((entry) => signature(entry, includeMetadataNames))
    .sort();
}

function sourceAbi(): AbiEntry[] {
  const source = path.resolve(
    __dirname,
    "../../contracts/mint-up-event-pass/abi/IMintUpEventPass.sol",
  );
  const output = JSON.parse(
    execFileSync("solc", ["--combined-json", "abi", source], {
      encoding: "utf8",
    }),
  ) as { contracts: Record<string, { abi: AbiEntry[] }> };
  const contract = Object.values(output.contracts)[0];
  if (!contract) throw new Error("Solidity source ABI was not generated");
  return contract.abi;
}

function stylusAbi(): AbiEntry[] {
  const contractDirectory = path.resolve(
    __dirname,
    "../../contracts/mint-up-event-pass",
  );
  const output = execFileSync("cargo", ["stylus", "export-abi", "--json"], {
    cwd: contractDirectory,
    encoding: "utf8",
  });
  const json = output.slice(output.indexOf("["));
  return JSON.parse(json) as AbiEntry[];
}

function stylusEventAbi(): AbiEntry[] {
  const contractDirectory = path.resolve(
    __dirname,
    "../../contracts/mint-up-event-pass",
  );
  const metadata = JSON.parse(
    execFileSync("cargo", ["metadata", "--format-version", "1"], {
      cwd: contractDirectory,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    }),
  ) as { packages: { manifest_path: string; name: string }[] };
  const openZeppelinManifest = metadata.packages.find(
    (entry) => entry.name === "openzeppelin-stylus",
  )?.manifest_path;
  if (!openZeppelinManifest) {
    throw new Error("OpenZeppelin Stylus dependency was not resolved");
  }
  const openZeppelinRoot = path.dirname(openZeppelinManifest);
  const sources = [
    path.join(contractDirectory, "src/lib.rs"),
    path.join(openZeppelinRoot, "src/token/erc721/mod.rs"),
    path.join(openZeppelinRoot, "src/token/erc721/extensions/uri_storage.rs"),
  ].map((source) => fs.readFileSync(source, "utf8"));
  const events = sources.flatMap(
    (source) => source.match(/event\s+\w+\s*\([^;]+\);/gs) ?? [],
  );
  const output = JSON.parse(
    execFileSync("solc", ["--combined-json", "abi", "-"], {
      encoding: "utf8",
      input: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
interface StylusEvents { ${events.join("\n")} }`,
    }),
  ) as { contracts: Record<string, { abi: AbiEntry[] }> };
  const contract = Object.values(output.contracts)[0];
  if (!contract) throw new Error("Stylus event ABI was not generated");
  return contract.abi;
}

function checkedInAbi(): AbiEntry[] {
  return JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        "../../contracts/mint-up-event-pass/abi/IMintUpEventPass.abi",
      ),
      "utf8",
    ),
  ) as AbiEntry[];
}

function publishedStylusAbi(): AbiEntry[] {
  const artifact = fs.readFileSync(
    path.resolve(__dirname, "../../deployments/mint-up-event-pass"),
    "utf8",
  );
  const json = artifact.slice(artifact.indexOf("["));
  return JSON.parse(json) as AbiEntry[];
}

describe("Event Pass ABI parity", () => {
  it("keeps source, Stylus export, and generated frontend signatures aligned", () => {
    const source = sourceAbi();
    const stylus = stylusAbi();
    const stylusEvents = stylusEventAbi();
    const checkedIn = checkedInAbi();
    const publishedStylus = publishedStylusAbi();
    const generatedLocal = generatedStylusAbi as readonly AbiEntry[];
    const frontendAbis = Object.values(deployedContracts).map(
      (contracts) => contracts["mint-up-event-pass"].abi as readonly AbiEntry[],
    );

    expect(signatures(stylus, ["function", "error"], false)).toEqual(
      signatures(source, ["function", "error"], false),
    );
    const stylusEventNames = new Set(stylusEvents.map((event) => event.name));
    expect(signatures(stylusEvents, ["event"], true)).toEqual(
      signatures(
        source.filter((event) => stylusEventNames.has(event.name)),
        ["event"],
        true,
      ),
    );
    expect(
      signatures(publishedStylus, ["function", "error", "event"], true),
    ).toEqual(signatures(source, ["function", "error", "event"], true));
    expect(
      signatures(generatedLocal, ["function", "error", "event"], true),
    ).toEqual(signatures(source, ["function", "error", "event"], true));
    for (const frontend of frontendAbis) {
      expect(
        signatures(frontend, ["function", "error", "event"], true),
      ).toEqual(signatures(source, ["function", "error", "event"], true));
    }
    expect(signatures(checkedIn, ["function", "error", "event"], true)).toEqual(
      signatures(source, ["function", "error", "event"], true),
    );
  });
});
