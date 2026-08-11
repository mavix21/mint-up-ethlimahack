"use client";

import { Address, formatEther } from "viem";
import { Alert, AlertTitle } from "~~/components/ui/alert";
import { Button } from "~~/components/ui/button";
import { Skeleton } from "~~/components/ui/skeleton";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useWatchBalance } from "~~/hooks/scaffold-eth/useWatchBalance";

type BalanceProps = {
  address?: Address;
  className?: string;
};

/**
 * Display ETH balance of an ETH address.
 */
export const Balance = ({ address, className = "" }: BalanceProps) => {
  const { targetNetwork } = useTargetNetwork();

  const {
    data: balance,
    isError,
    isLoading,
  } = useWatchBalance({
    address,
  });

  if (!address || isLoading || balance === null) {
    return (
      <div className="flex space-x-4">
        <Skeleton className="size-6 rounded-md" />
        <div className="flex items-center">
          <Skeleton className="h-2 w-28 rounded-sm" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Saldo no disponible</AlertTitle>
      </Alert>
    );
  }

  const formattedBalance = balance ? Number(formatEther(balance.value)) : 0;

  return (
    <div className={className}>
      <Button variant="ghost" size="sm" type="button">
        <span>{formattedBalance.toFixed(4)}</span>
        <span>{targetNetwork.nativeCurrency.symbol}</span>
      </Button>
    </div>
  );
};
