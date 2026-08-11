"use client";

import { useEffect, useState } from "react";
import { Address, createPublicClient, http, toHex } from "viem";
import { Card, CardContent } from "~~/components/ui/card";
import { ScrollArea } from "~~/components/ui/scroll-area";
import { arbitrumNitro } from "~~/utils/scaffold-stylus/supportedChains";

const publicClient = createPublicClient({
  chain: arbitrumNitro,
  transport: http(),
});

export const AddressStorageTab = ({ address }: { address: Address }) => {
  const [storage, setStorage] = useState<string[]>([]);

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const storageData = [];
        let idx = 0;

        while (true) {
          const storageAtPosition = await publicClient.getStorageAt({
            address: address,
            slot: toHex(idx),
          });

          if (storageAtPosition === "0x" + "0".repeat(64)) break;

          if (storageAtPosition) {
            storageData.push(storageAtPosition);
          }

          idx++;
        }
        setStorage(storageData);
      } catch (error) {
        console.error("Failed to fetch storage:", error);
      }
    };

    fetchStorage();
  }, [address]);

  return (
    <div className="flex flex-col gap-3 p-4">
      {storage.length > 0 ? (
        <Card>
          <CardContent>
            <ScrollArea className="max-h-[500px]">
              <pre className="whitespace-pre-wrap break-words">
                <code>
                  {storage.map((data, i) => (
                    <span className="block" key={i}>
                      <strong>Slot de almacenamiento {i}:</strong> {data}
                    </span>
                  ))}
                </code>
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <div className="text-lg">Este contrato no tiene variables.</div>
      )}
    </div>
  );
};
