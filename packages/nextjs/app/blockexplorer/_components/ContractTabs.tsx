"use client";

import { useEffect, useState } from "react";
import { AddressCodeTab } from "./AddressCodeTab";
import { AddressLogsTab } from "./AddressLogsTab";
import { AddressStorageTab } from "./AddressStorageTab";
import { PaginationButton } from "./PaginationButton";
import { TransactionsTable } from "./TransactionsTable";
import { Address, createPublicClient, http } from "viem";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~~/components/ui/tabs";
import { useFetchBlocks } from "~~/hooks/scaffold-eth";
import { arbitrumNitro } from "~~/utils/scaffold-stylus/supportedChains";

type AddressCodeTabProps = {
  bytecode: string;
  assembly: string;
};

type PageProps = {
  address: Address;
  contractData: AddressCodeTabProps | null;
};

const publicClient = createPublicClient({
  chain: arbitrumNitro,
  transport: http(),
});

export const ContractTabs = ({ address, contractData }: PageProps) => {
  const {
    blocks,
    transactionReceipts,
    currentPage,
    hasNextPage,
    setCurrentPage,
  } = useFetchBlocks(address);
  const [activeTab, setActiveTab] = useState("transactions");
  const [isContract, setIsContract] = useState(false);

  useEffect(() => {
    const checkIsContract = async () => {
      const contractCode = await publicClient.getBytecode({ address: address });
      setIsContract(contractCode !== undefined && contractCode !== "0x");
    };

    checkIsContract();
  }, [address]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {isContract && (
        <TabsList>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
          <TabsTrigger value="code">Código</TabsTrigger>
          <TabsTrigger value="storage">Almacenamiento</TabsTrigger>
          <TabsTrigger value="logs">Registros</TabsTrigger>
        </TabsList>
      )}
      <TabsContent value="transactions">
        <div>
          <TransactionsTable
            blocks={blocks}
            transactionReceipts={transactionReceipts}
          />
          <PaginationButton
            currentPage={currentPage}
            hasNextPage={hasNextPage}
            setCurrentPage={setCurrentPage}
          />
        </div>
      </TabsContent>
      <TabsContent value="code">
        {contractData ? (
          <AddressCodeTab
            bytecode={contractData.bytecode}
            assembly={contractData.assembly}
          />
        ) : null}
      </TabsContent>
      <TabsContent value="storage">
        <AddressStorageTab address={address} />
      </TabsContent>
      <TabsContent value="logs">
        <AddressLogsTab address={address} />
      </TabsContent>
    </Tabs>
  );
};
