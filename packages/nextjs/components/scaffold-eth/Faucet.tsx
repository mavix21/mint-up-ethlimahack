"use client";

import { useEffect, useState } from "react";
import { Address as AddressType, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useAccount } from "wagmi";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { Address, AddressInput, Balance, EtherInput } from "~~/components/scaffold-eth";
import { Button } from "~~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~~/components/ui/dialog";
import { Spinner } from "~~/components/ui/spinner";
import { useTransactor } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { arbitrumNitro } from "~~/utils/scaffold-stylus/supportedChains";

const FAUCET_ACCOUNT_INDEX = 0;

const localWalletClient = createWalletClient({
  account: privateKeyToAccount(arbitrumNitro.accounts[0].privateKey),
  chain: arbitrumNitro,
  transport: http(arbitrumNitro.rpcUrls.default.http[0]),
});

/**
 * Faucet dialog which lets you send ETH to any address.
 */
export const Faucet = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputAddress, setInputAddress] = useState<AddressType>();
  const [faucetAddress, setFaucetAddress] = useState<AddressType>(arbitrumNitro.accounts[0].address);
  const [sendValue, setSendValue] = useState("");
  const { chain: connectedChain } = useAccount();
  const faucetTxn = useTransactor(localWalletClient);

  useEffect(() => {
    const getFaucetAddress = async () => {
      try {
        const accounts = await localWalletClient.getAddresses();
        setFaucetAddress(accounts[FAUCET_ACCOUNT_INDEX]);
      } catch (error) {
        notification.error(
          <>
            <p className="font-bold mt-0 mb-1">Cannot connect to local provider</p>
            <p className="m-0">
              - Did you forget to run <code className="bg-muted font-bold italic">yarn chain</code> ?
            </p>
            <p className="mt-1 break-normal">
              - Or you can change <code className="bg-muted font-bold italic">targetNetwork</code> in{" "}
              <code className="bg-muted font-bold italic">scaffold.config.ts</code>
            </p>
          </>,
        );
        console.error("Faucet address lookup failed", error);
      }
    };

    getFaucetAddress();
  }, []);

  const sendETH = async () => {
    if (!faucetAddress || !inputAddress) return;

    try {
      setLoading(true);
      await faucetTxn({
        to: inputAddress,
        value: parseEther(sendValue as `${number}`),
      });
      setInputAddress(undefined);
      setSendValue("");
    } catch (error) {
      console.error("Faucet transaction failed", error);
    } finally {
      setLoading(false);
    }
  };

  if (connectedChain?.id !== arbitrumNitro.id) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <BanknotesIcon />
        <span>Faucet</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Local faucet</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex space-x-4">
            <div>
              <span className="text-sm font-bold">From:</span>
              <Address address={faucetAddress} onlyEnsOrAddress />
            </div>
            <div>
              <span className="text-sm font-bold pl-3">Available:</span>
              <Balance address={faucetAddress} />
            </div>
          </div>
          <div className="flex flex-col space-y-3">
            <AddressInput
              placeholder="Destination Address"
              value={inputAddress ?? ""}
              onChange={value => setInputAddress(value as AddressType)}
            />
            <EtherInput placeholder="Amount to send" value={sendValue} onChange={setSendValue} />
            <Button onClick={sendETH} disabled={loading}>
              {loading ? <Spinner /> : <BanknotesIcon />}
              <span>Send</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
