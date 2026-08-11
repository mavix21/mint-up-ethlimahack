"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Hash,
  Transaction,
  TransactionReceipt,
  formatEther,
  formatUnits,
} from "viem";
import { usePublicClient } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { Badge } from "~~/components/ui/badge";
import { Button } from "~~/components/ui/button";
import { Card, CardContent } from "~~/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "~~/components/ui/table";
import { Textarea } from "~~/components/ui/textarea";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import {
  decodeTransactionData,
  getFunctionDetails,
} from "~~/utils/scaffold-eth";
import { replacer } from "~~/utils/scaffold-eth/common";
import { arbitrumNitro } from "~~/utils/scaffold-stylus/supportedChains";

const TransactionComp = ({ txHash }: { txHash: Hash }) => {
  const client = usePublicClient({ chainId: arbitrumNitro.id });
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction>();
  const [receipt, setReceipt] = useState<TransactionReceipt>();
  const [functionCalled, setFunctionCalled] = useState<string>();

  const { targetNetwork } = useTargetNetwork();

  useEffect(() => {
    if (txHash && client) {
      const fetchTransaction = async () => {
        const tx = await client.getTransaction({ hash: txHash });
        const receipt = await client.getTransactionReceipt({ hash: txHash });

        const transactionWithDecodedData = decodeTransactionData(tx);
        setTransaction(transactionWithDecodedData);
        setReceipt(receipt);

        const functionCalled = transactionWithDecodedData.input.substring(
          0,
          10,
        );
        setFunctionCalled(functionCalled);
      };

      fetchTransaction();
    }
  }, [client, txHash]);

  return (
    <div className="container mx-auto mt-10 mb-20 px-10 md:px-0">
      <Button onClick={() => router.back()}>Volver</Button>
      {transaction ? (
        <div className="overflow-x-auto">
          <h2 className="mb-4 text-center text-3xl font-bold text-foreground">
            Detalles de la transacción
          </h2>{" "}
          <Card>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <strong>Hash de transacción:</strong>
                    </TableCell>
                    <TableCell>{transaction.hash}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Número de bloque:</strong>
                    </TableCell>
                    <TableCell>{Number(transaction.blockNumber)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Desde:</strong>
                    </TableCell>
                    <TableCell>
                      <Address
                        address={transaction.from}
                        format="long"
                        onlyEnsOrAddress
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Hacia:</strong>
                    </TableCell>
                    <TableCell>
                      {!receipt?.contractAddress ? (
                        transaction.to && (
                          <Address
                            address={transaction.to}
                            format="long"
                            onlyEnsOrAddress
                          />
                        )
                      ) : (
                        <div>
                          Creación de contrato:
                          <Address
                            address={receipt.contractAddress}
                            format="long"
                            onlyEnsOrAddress
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Valor:</strong>
                    </TableCell>
                    <TableCell>
                      {formatEther(transaction.value)}{" "}
                      {targetNetwork.nativeCurrency.symbol}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Función llamada:</strong>
                    </TableCell>
                    <TableCell>
                      <div className="w-full md:max-w-[600px] lg:max-w-[800px] overflow-x-auto whitespace-nowrap">
                        {functionCalled === "0x" ? (
                          "Esta transacción no llamó a ninguna función."
                        ) : (
                          <>
                            <span className="mr-2">
                              {getFunctionDetails(transaction)}
                            </span>
                            <Badge>{functionCalled}</Badge>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Precio del gas:</strong>
                    </TableCell>
                    <TableCell>
                      {formatUnits(transaction.gasPrice || 0n, 9)} Gwei
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Datos:</strong>
                    </TableCell>
                    <TableCell>
                      <Textarea readOnly value={transaction.input} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Registros:</strong>
                    </TableCell>
                    <TableCell>
                      <ul>
                        {receipt?.logs?.map((log, i) => (
                          <li key={i}>
                            <strong>Topics del registro {i}:</strong>{" "}
                            {JSON.stringify(log.topics, replacer, 2)}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-2xl text-foreground">Cargando...</p>
      )}
    </div>
  );
};

export default TransactionComp;
