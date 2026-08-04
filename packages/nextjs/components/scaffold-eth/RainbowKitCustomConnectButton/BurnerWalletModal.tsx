import { useState } from "react";
import { BlockieAvatar } from "..";
import { Button } from "~~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~~/components/ui/dialog";
import { arbitrumNitro } from "~~/utils/scaffold-stylus/supportedChains";

type BurnerWalletModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAccount: (privateKey: string) => void;
};

export const BurnerWalletModal = ({ open, onOpenChange, onSelectAccount }: BurnerWalletModalProps) => {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const handleAccountSelect = (privateKey: string, address: string) => {
    setSelectedAccount(address);
    onOpenChange(false);
    onSelectAccount(privateKey);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose account</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {arbitrumNitro.accounts.map(account => (
            <div key={account.address}>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleAccountSelect(account.privateKey, account.address)}
                data-testid="burner-account-option"
              >
                <BlockieAvatar address={account.address} size={28} />
                <span>
                  {account.address.slice(0, 6)}...{account.address.slice(-4)}
                </span>
                {account.address === selectedAccount ? <span aria-label="Selected">Selected</span> : null}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
