import { TransactionHash } from "./TransactionHash";
import { formatEther } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { Badge } from "~~/components/ui/badge";
import { Card, CardContent } from "~~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~~/components/ui/table";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { TransactionWithFunction } from "~~/utils/scaffold-eth";
import { TransactionsTableProps } from "~~/utils/scaffold-eth/";

export const TransactionsTable = ({
  blocks,
  transactionReceipts,
}: TransactionsTableProps) => {
  const { targetNetwork } = useTargetNetwork();
  const hasTransactions = blocks.some(block => block.transactions.length > 0);

  return (
    <div className="flex justify-center px-4 md:px-0">
      <Card className="w-full">
        <CardContent>
          {!hasTransactions ? (
            <div className="p-8 text-center text-muted-foreground">
              No se encontraron transacciones en esta página.
            </div>
          ) : (
            <Table data-testid="blockexplorer-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Hash de transacción</TableHead>
                  <TableHead>Función llamada</TableHead>
                  <TableHead>Número de bloque</TableHead>
                  <TableHead>Hora de minado</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Hacia</TableHead>
                  <TableHead className="text-end">
                    Valor ({targetNetwork.nativeCurrency.symbol})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map(block =>
                  (block.transactions as TransactionWithFunction[]).map(tx => {
                    const receipt = transactionReceipts[tx.hash];
                    const timeMined = new Date(
                      Number(block.timestamp) * 1000,
                    ).toLocaleString();
                    const functionCalled = tx.input.substring(0, 10);

                    return (
                      <TableRow key={tx.hash} data-testid="blockexplorer-row">
                        <TableCell className="w-1/12 md:py-4">
                          <TransactionHash hash={tx.hash} />
                        </TableCell>
                        <TableCell className="w-2/12 md:py-4">
                          {/* {tx.functionName === "0x" ? "" : <span className="mr-1">{tx.functionName}</span>} */}
                          {functionCalled !== "0x" && (
                            <Badge>{functionCalled}</Badge>
                          )}
                        </TableCell>
                        <TableCell
                          className="w-1/12 md:py-4"
                          data-testid="blockexplorer-block-number"
                        >
                          {block.number?.toString()}
                        </TableCell>
                        <TableCell className="w-2/12 md:py-4">
                          {timeMined}
                        </TableCell>
                        <TableCell className="w-2/12 md:py-4">
                          <Address
                            address={tx.from}
                            size="sm"
                            onlyEnsOrAddress
                          />
                        </TableCell>
                        <TableCell className="w-2/12 md:py-4">
                          {!receipt?.contractAddress ? (
                            tx.to && (
                              <Address
                                address={tx.to}
                                size="sm"
                                onlyEnsOrAddress
                              />
                            )
                          ) : (
                            <div className="relative">
                              <Address
                                address={receipt.contractAddress}
                                size="sm"
                                onlyEnsOrAddress
                              />
                              <small className="absolute top-4 left-4">
                                (Creación de contrato)
                              </small>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right md:py-4">
                          {formatEther(tx.value)}{" "}
                          {targetNetwork.nativeCurrency.symbol}
                        </TableCell>
                      </TableRow>
                    );
                  }),
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
