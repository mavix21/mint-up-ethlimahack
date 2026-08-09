import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "@jest/globals";
import deployedContracts from "../../../nextjs/contracts/deployedContracts";

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

describe("Event Pass ABI parity", () => {
  it("keeps source, Stylus export, and generated frontend signatures aligned", () => {
    const source = sourceAbi();
    const stylus = stylusAbi();
    const checkedIn = checkedInAbi();
    const frontend = deployedContracts["412346"]["mint-up-event-pass"]
      .abi as readonly AbiEntry[];

    expect(signatures(stylus, ["function", "error"], false)).toEqual(
      signatures(source, ["function", "error"], false),
    );
    expect(signatures(frontend, ["function", "error", "event"], true)).toEqual(
      signatures(source, ["function", "error", "event"], true),
    );
    expect(signatures(checkedIn, ["function", "error", "event"], true)).toEqual(
      signatures(source, ["function", "error", "event"], true),
    );
  });
});
