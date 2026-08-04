"use client";

// @refresh reset
import { useReducer, useState } from "react";
import { ContractReadMethods } from "./ContractReadMethods";
import { ContractVariables } from "./ContractVariables";
import { ContractWriteMethods } from "./ContractWriteMethods";
import { Address, Balance } from "~~/components/scaffold-eth";
import { Card, CardContent, CardHeader, CardTitle } from "~~/components/ui/card";
import { Spinner } from "~~/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~~/components/ui/tabs";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { ContractName } from "~~/utils/scaffold-eth/contract";

type ContractUIProps = {
  contractName: ContractName;
  className?: string;
};

/**
 * UI component to interface with deployed contracts.
 **/
export const ContractUI = ({ contractName, className = "" }: ContractUIProps) => {
  const [activeTab, setActiveTab] = useState("write");
  const [refreshDisplayVariables, triggerRefreshDisplayVariables] = useReducer(value => !value, false);
  const { targetNetwork } = useTargetNetwork();
  const { data: deployedContractData, isLoading: deployedContractLoading } = useDeployedContractInfo({ contractName });

  const tabs = [
    { id: "write", label: "Write" },
    { id: "read", label: "Read" },
  ];

  if (deployedContractLoading) {
    return (
      <div className="mt-14">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!deployedContractData) {
    return (
      <p className="text-3xl mt-14">
        {`No contract found by the name of "${contractName.toString()}" on chain "${targetNetwork.name}"!`}
      </p>
    );
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-6 px-6 lg:px-10 lg:gap-12 w-full max-w-7xl my-0 ${className}`}>
      <div className="col-span-5 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        <div className="col-span-1 flex flex-col">
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle>{contractName.toString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <Address address={deployedContractData.address} onlyEnsOrAddress />
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Balance:</span>
                    <Balance address={deployedContractData.address} />
                  </div>
                  {targetNetwork ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Network:</span>
                      <span className="text-sm text-primary">{targetNetwork.name}</span>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent>
              <ContractVariables
                refreshDisplayVariables={refreshDisplayVariables}
                deployedContractData={deployedContractData}
              />
            </CardContent>
          </Card>
        </div>
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              {tabs.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <Card>
              <CardContent>
                <TabsContent value="read" keepMounted>
                  <div className="divide-y divide-border">
                    <ContractReadMethods deployedContractData={deployedContractData} />
                  </div>
                </TabsContent>
                <TabsContent value="write" keepMounted>
                  <div className="divide-y divide-border">
                    <ContractWriteMethods
                      deployedContractData={deployedContractData}
                      onChange={triggerRefreshDisplayVariables}
                    />
                  </div>
                </TabsContent>
              </CardContent>
              {deployedContractLoading ? <Spinner /> : null}
            </Card>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
