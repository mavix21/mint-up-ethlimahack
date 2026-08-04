import { Address } from "viem";
import { Card, CardContent } from "~~/components/ui/card";
import { ScrollArea } from "~~/components/ui/scroll-area";
import { useContractLogs } from "~~/hooks/scaffold-eth";
import { replacer } from "~~/utils/scaffold-eth/common";

export const AddressLogsTab = ({ address }: { address: Address }) => {
  const contractLogs = useContractLogs(address);

  return (
    <div className="flex flex-col gap-3 p-4">
      <Card>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <pre className="whitespace-pre-wrap break-words">
              <code>
                {contractLogs.map((log, i) => (
                  <span className="block" key={i}>
                    <strong>Log:</strong> {JSON.stringify(log, replacer, 2)}
                  </span>
                ))}
              </code>
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
