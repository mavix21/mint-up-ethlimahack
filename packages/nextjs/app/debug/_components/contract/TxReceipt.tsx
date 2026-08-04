import { useState } from "react";
import { TransactionReceipt } from "viem";
import { CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { ObjectFieldDisplay } from "~~/app/debug/_components/contract";
import { Button } from "~~/components/ui/button";
import { Card, CardContent } from "~~/components/ui/card";
import { useCopyToClipboard } from "~~/hooks/scaffold-eth/useCopyToClipboard";
import { replacer } from "~~/utils/scaffold-eth/common";

export const TxReceipt = ({ txResult }: { txResult: TransactionReceipt }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { copyToClipboard: copyTxResultToClipboard, isCopiedToClipboard: isTxResultCopiedToClipboard } =
    useCopyToClipboard();

  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-center">
          {isTxResultCopiedToClipboard ? (
            <CheckCircleIcon className="size-5 text-foreground" aria-hidden="true" />
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => copyTxResultToClipboard(JSON.stringify(txResult, replacer, 2))}
              aria-label="Copy transaction receipt"
            >
              <DocumentDuplicateIcon />
            </Button>
          )}
          <div className="flex flex-1 items-center pl-2">
            <strong>Transaction Receipt</strong>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Collapse transaction receipt" : "Expand transaction receipt"}
          >
            {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </Button>
        </div>

        {isExpanded ? (
          <div className="mt-2 overflow-auto">
            {Object.entries(txResult).map(([k, v]) => (
              <ObjectFieldDisplay name={k} value={v} size="xs" leftPad={false} key={k} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
