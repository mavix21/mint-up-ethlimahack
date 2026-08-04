"use client";

import { useState } from "react";
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useAccount } from "wagmi";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { Button } from "~~/components/ui/button";
import { Spinner } from "~~/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "~~/components/ui/tooltip";
import { useTransactor } from "~~/hooks/scaffold-eth";
import { useWatchBalance } from "~~/hooks/scaffold-eth/useWatchBalance";
import { arbitrumNitro } from "~~/utils/scaffold-stylus/supportedChains";

const NUM_OF_ETH = "1";

const localWalletClient = createWalletClient({
  account: privateKeyToAccount(arbitrumNitro.accounts[0].privateKey),
  chain: arbitrumNitro,
  transport: http(arbitrumNitro.rpcUrls.default.http[0]),
});

/**
 * Faucet button which lets you grab ETH.
 */
export const FaucetButton = () => {
  const { address, chain: connectedChain } = useAccount();
  const { data: balance } = useWatchBalance({ address });
  const [loading, setLoading] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const faucetTxn = useTransactor(localWalletClient);

  const sendETH = async () => {
    if (!address) return;

    try {
      setLoading(true);
      await faucetTxn({
        to: address,
        value: parseEther(NUM_OF_ETH),
      });
    } catch (error) {
      console.error("Faucet transaction failed", error);
    } finally {
      setLoading(false);
    }
  };

  if (connectedChain?.id !== arbitrumNitro.id) return null;

  const isBalanceZero = balance?.value === 0n;

  return (
    <Tooltip open={isBalanceZero || tooltipOpen} onOpenChange={setTooltipOpen}>
      <TooltipTrigger
        render={
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={sendETH}
            disabled={loading}
            aria-label="Grab funds from faucet"
          />
        }
      >
        {loading ? <Spinner /> : <BanknotesIcon />}
      </TooltipTrigger>
      <TooltipContent side="bottom">Grab funds from faucet</TooltipContent>
    </Tooltip>
  );
};
