import { useEffect } from "react";
import { rainbowkitBurnerWallet } from "burner-connector";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { Alert, AlertDescription, AlertTitle } from "~~/components/ui/alert";
import { Button } from "~~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~~/components/ui/dialog";
import { useCopyToClipboard } from "~~/hooks/scaffold-eth";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const BURNER_WALLET_PK_KEY = "burnerWallet.pk";

type RevealBurnerPKModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const RevealBurnerPKModal = ({ open, onOpenChange }: RevealBurnerPKModalProps) => {
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();

  useEffect(() => () => onOpenChange(false), [onOpenChange]);

  const handleCopyPK = async () => {
    try {
      const storage = rainbowkitBurnerWallet.useSessionStorage ? sessionStorage : localStorage;
      const burnerPK = storage?.getItem(BURNER_WALLET_PK_KEY);
      if (!burnerPK) throw new Error("Burner wallet private key not found");
      await copyToClipboard(burnerPK);
      notification.success("Burner wallet private key copied to clipboard");
    } catch (error) {
      notification.error(getParsedError(error));
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy burner wallet private key</DialogTitle>
        </DialogHeader>
        <Alert variant="destructive">
          <ShieldExclamationIcon />
          <AlertTitle>Local development only</AlertTitle>
          <AlertDescription>
            Burner wallets are not safe for storing real funds. The private key provides full access to this wallet and
            is stored temporarily in your browser.
          </AlertDescription>
        </Alert>
        <Button variant="destructive" onClick={handleCopyPK} disabled={isCopiedToClipboard}>
          Copy private key to clipboard
        </Button>
      </DialogContent>
    </Dialog>
  );
};
