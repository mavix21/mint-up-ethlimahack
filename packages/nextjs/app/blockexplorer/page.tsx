"use client";

import { useEffect, useState } from "react";
import { PaginationButton, SearchBar, TransactionsTable } from "./_components";
import type { NextPage } from "next";
import { useFetchBlocks } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { notification } from "~~/utils/scaffold-eth";
import { arbitrumNitro } from "~~/utils/scaffold-stylus/supportedChains";

const BlockExplorer: NextPage = () => {
  const {
    blocks,
    transactionReceipts,
    currentPage,
    hasNextPage,
    setCurrentPage,
    error,
  } = useFetchBlocks();
  const { targetNetwork } = useTargetNetwork();
  const [isLocalNetwork, setIsLocalNetwork] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (targetNetwork.id !== arbitrumNitro.id) {
      setIsLocalNetwork(false);
    }
  }, [targetNetwork.id]);

  useEffect(() => {
    if (targetNetwork.id === arbitrumNitro.id && error) {
      setHasError(true);
    }
  }, [targetNetwork.id, error]);

  useEffect(() => {
    if (!isLocalNetwork) {
      notification.error(
        <>
          <p className="font-bold mt-0 mb-1">
            <code className="bg-muted text-base font-bold italic">
              {" "}
              targetNetwork{" "}
            </code>{" "}
            no es localhost
          </p>
          <p className="m-0">
            - Estás en{" "}
            <code className="bg-muted text-base font-bold italic">
              {targetNetwork.name}
            </code>{" "}
            . Este explorador de bloques es solo para{" "}
            <code className="bg-muted text-base font-bold italic">
              localhost
            </code>
            .
          </p>
          <p className="mt-1 break-normal">
            - Puedes usar{" "}
            <a
              className="text-primary"
              href={targetNetwork.blockExplorers?.default.url}
            >
              {targetNetwork.blockExplorers?.default.name}
            </a>{" "}
            en su lugar
          </p>
        </>,
      );
    }
  }, [
    isLocalNetwork,
    targetNetwork.blockExplorers?.default.name,
    targetNetwork.blockExplorers?.default.url,
    targetNetwork.name,
  ]);

  useEffect(() => {
    if (hasError) {
      notification.error(
        <>
          <p className="font-bold mt-0 mb-1">
            No se puede conectar con el proveedor local
          </p>
          <p className="m-0">
            - ¿Olvidaste ejecutar{" "}
            <code className="bg-muted text-base font-bold italic">
              yarn chain
            </code>{" "}
            ?
          </p>
          <p className="mt-1 break-normal">
            - O puedes cambiar{" "}
            <code className="bg-muted text-base font-bold italic">
              targetNetwork
            </code>{" "}
            en{" "}
            <code className="bg-muted text-base font-bold italic">
              scaffold.config.ts
            </code>
          </p>
        </>,
      );
    }
  }, [hasError]);

  return (
    <div className="container mx-auto my-10">
      <SearchBar />
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
  );
};

export default BlockExplorer;
