"use client";

import { useEffect, useMemo, useState } from "react";
import { InheritanceTooltip } from "./InheritanceTooltip";
import { Abi, AbiFunction } from "abitype";
import { Address, TransactionReceipt } from "viem";
import { useAccount, useConfig, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  ContractInput,
  TxReceipt,
  getFunctionInputKey,
  getInitialFormState,
  getParsedContractFunctionArgs,
  transformAbiFunction,
} from "~~/app/debug/_components/contract";
import { IntegerInput } from "~~/components/scaffold-eth";
import { Button } from "~~/components/ui/button";
import { Spinner } from "~~/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "~~/components/ui/tooltip";
import { useTransactor } from "~~/hooks/scaffold-eth";
import { applyGasFeeMultiplier } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { simulateContractWriteAndNotifyError } from "~~/utils/scaffold-eth/contract";
import { AllowedChainIds } from "~~/utils/scaffold-stylus";

type WriteOnlyFunctionFormProps = {
  abi: Abi;
  abiFunction: AbiFunction;
  onChange: () => void;
  contractAddress: Address;
  inheritedFrom?: string;
};

export const WriteOnlyFunctionForm = ({
  abi,
  abiFunction,
  onChange,
  contractAddress,
  inheritedFrom,
}: WriteOnlyFunctionFormProps) => {
  const [form, setForm] = useState<Record<string, any>>(() => getInitialFormState(abiFunction));
  const [txValue, setTxValue] = useState<string>("");
  const { chain } = useAccount();
  const writeTxn = useTransactor();
  const { targetNetwork } = useTargetNetwork();
  const writeDisabled = !chain || chain?.id !== targetNetwork.id;

  const { data: result, isPending, writeContractAsync } = useWriteContract();

  const wagmiConfig = useConfig();

  const handleWrite = async () => {
    if (writeContractAsync) {
      try {
        const writeContractObj = {
          address: contractAddress,
          functionName: abiFunction.name,
          abi: abi,
          args: getParsedContractFunctionArgs(form),
          value: BigInt(txValue),
        };
        const bufferedWriteContractObj = await applyGasFeeMultiplier(
          writeContractObj as any,
          targetNetwork.id as AllowedChainIds,
        );
        await simulateContractWriteAndNotifyError({
          wagmiConfig,
          writeContractParams: bufferedWriteContractObj,
          chainId: targetNetwork.id as AllowedChainIds,
        });

        const makeWriteWithParams = () => writeContractAsync(bufferedWriteContractObj as typeof writeContractObj);
        await writeTxn(makeWriteWithParams);
        onChange();
      } catch (e: any) {
        console.error("⚡️ ~ file: WriteOnlyFunctionForm.tsx:handleWrite ~ error", e);
      }
    }
  };

  const [displayedTxResult, setDisplayedTxResult] = useState<TransactionReceipt>();
  const { data: txResult } = useWaitForTransactionReceipt({
    hash: result,
  });
  useEffect(() => {
    setDisplayedTxResult(txResult);
  }, [txResult]);

  const transformedFunction = useMemo(() => transformAbiFunction(abiFunction), [abiFunction]);
  const inputs = transformedFunction.inputs.map((input, inputIndex) => {
    const key = getFunctionInputKey(abiFunction.name, input, inputIndex);
    return (
      <ContractInput
        key={key}
        setForm={updatedFormValue => {
          setDisplayedTxResult(undefined);
          setForm(updatedFormValue);
        }}
        form={form}
        stateObjectKey={key}
        paramType={input}
      />
    );
  });
  const zeroInputs = inputs.length === 0 && abiFunction.stateMutability !== "payable";
  const writeButton = (
    <Button
      type="button"
      disabled={writeDisabled || isPending}
      onClick={handleWrite}
      data-testid="write-function-submit"
    >
      {isPending && <Spinner />}
      Send
    </Button>
  );

  return (
    <div className="py-5 space-y-3 first:pt-0 last:pb-1">
      <div
        className={`flex gap-3 ${zeroInputs ? "flex-row justify-between items-center" : "flex-col"}`}
        data-testid={`write-function-form-${abiFunction.name}`}
      >
        <p className="my-0 break-words font-medium text-primary">
          {abiFunction.name}
          <InheritanceTooltip inheritedFrom={inheritedFrom} />
        </p>
        {inputs}
        {abiFunction.stateMutability === "payable" ? (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center ml-2">
              <span className="text-xs font-medium mr-2 leading-none">payable value</span>
              <span className="block text-xs leading-none text-muted-foreground">wei</span>
            </div>
            <IntegerInput
              value={txValue}
              onChange={updatedTxValue => {
                setDisplayedTxResult(undefined);
                setTxValue(updatedTxValue);
              }}
              placeholder="value (wei)"
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          {!zeroInputs && (
            <div className="w-full">{displayedTxResult ? <TxReceipt txResult={displayedTxResult} /> : null}</div>
          )}
          <div className="flex justify-end">
            {writeDisabled ? (
              <Tooltip>
                <TooltipTrigger render={<span />}>{writeButton}</TooltipTrigger>
                <TooltipContent side="bottom">Wallet not connected or in the wrong network</TooltipContent>
              </Tooltip>
            ) : (
              writeButton
            )}
          </div>
        </div>
      </div>
      {zeroInputs && txResult ? (
        <div className="w-full">
          <TxReceipt txResult={txResult} />
        </div>
      ) : null}
    </div>
  );
};
