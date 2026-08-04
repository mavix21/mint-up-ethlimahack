"use client";

import { useEffect, useMemo } from "react";
import { LocalTestingGuide } from "./LocalTestingGuide";
import { useSessionStorage } from "usehooks-ts";
import { BarsArrowUpIcon } from "@heroicons/react/20/solid";
import { ContractUI } from "~~/app/debug/_components/contract";
import { Button } from "~~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~~/components/ui/tooltip";
import { ContractName, GenericContract } from "~~/utils/scaffold-eth/contract";
import { useAllContracts } from "~~/utils/scaffold-eth/contractsData";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { arbitrumNitro } from "~~/utils/scaffold-stylus";

const selectedContractStorageKey = "scaffoldEth2.selectedContract";

export function DebugContracts() {
  const contractsData = useAllContracts();
  const { targetNetwork } = useTargetNetwork();
  const contractsByName = contractsData as Record<string, GenericContract>;
  const eventPass = contractsByName["mint-up-event-pass"];
  const mockUsdc = contractsByName["mock-usdc"];
  const contractNames = useMemo(
    () =>
      Object.keys(contractsData).sort((a, b) => {
        return a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }) as ContractName[],
    [contractsData],
  );

  const [selectedContract, setSelectedContract] =
    useSessionStorage<ContractName>(
      selectedContractStorageKey,
      contractNames[0],
      { initializeWithValue: false },
    );

  useEffect(() => {
    if (!contractNames.includes(selectedContract)) {
      setSelectedContract(contractNames[0]);
    }
  }, [contractNames, selectedContract, setSelectedContract]);

  return (
    <div className="flex flex-col gap-y-6 lg:gap-y-8 py-8 lg:py-12 justify-center items-center">
      {contractNames.length === 0 ? (
        <p className="text-3xl mt-14">No contracts found!</p>
      ) : (
        <>
          {targetNetwork.id === arbitrumNitro.id && eventPass && mockUsdc ? (
            <div className="w-full px-6 lg:px-10">
              <LocalTestingGuide
                eventPass={eventPass.address}
                usdc={mockUsdc.address}
              />
            </div>
          ) : null}
          {contractNames.length > 1 && (
            <div className="flex flex-row gap-2 w-full max-w-7xl pb-1 px-6 lg:px-10 flex-wrap">
              {contractNames.map(contractName => (
                <Button
                  key={contractName}
                  type="button"
                  variant={
                    contractName === selectedContract ? "default" : "outline"
                  }
                  onClick={() => setSelectedContract(contractName)}
                >
                  {contractName}
                  {(contractsData[contractName] as GenericContract)
                    ?.external && (
                    <Tooltip>
                      <TooltipTrigger render={<span />}>
                        <BarsArrowUpIcon aria-label="External contract" />
                      </TooltipTrigger>
                      <TooltipContent>External contract</TooltipContent>
                    </Tooltip>
                  )}
                </Button>
              ))}
            </div>
          )}
          {contractNames.map(contractName => (
            <ContractUI
              key={contractName}
              contractName={contractName}
              className={contractName === selectedContract ? "" : "hidden"}
            />
          ))}
        </>
      )}
    </div>
  );
}
