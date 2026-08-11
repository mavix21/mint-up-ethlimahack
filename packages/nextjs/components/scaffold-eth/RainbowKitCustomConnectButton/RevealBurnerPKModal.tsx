import { useEffect } from "react";
import { rainbowkitBurnerWallet } from "burner-connector";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { Alert, AlertDescription, AlertTitle } from "~~/components/ui/alert";
import { Button } from "~~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~~/components/ui/dialog";
import { useCopyToClipboard } from "~~/hooks/scaffold-eth";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

const BURNER_WALLET_PK_KEY = "burnerWallet.pk";

type RevealBurnerPKModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const RevealBurnerPKModal = ({
  open,
  onOpenChange,
}: RevealBurnerPKModalProps) => {
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();

  useEffect(() => () => onOpenChange(false), [onOpenChange]);

  const handleCopyPK = async () => {
    try {
      const storage = rainbowkitBurnerWallet.useSessionStorage
        ? sessionStorage
        : localStorage;
      const burnerPK = storage?.getItem(BURNER_WALLET_PK_KEY);
      if (!burnerPK)
        throw new Error("No se encontró la clave privada de la burner wallet");
      await copyToClipboard(burnerPK);
      notification.success(
        "Clave privada de la burner wallet copiada al portapapeles",
      );
    } catch (error) {
      notification.error(getParsedError(error));
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar la clave privada de la burner wallet</DialogTitle>
        </DialogHeader>
        <Alert variant="destructive">
          <ShieldExclamationIcon />
          <AlertTitle>Solo para desarrollo local</AlertTitle>
          <AlertDescription>
            Las burner wallets no son seguras para guardar fondos reales. La
            clave privada brinda acceso completo a esta billetera y se almacena
            temporalmente en tu navegador.
          </AlertDescription>
        </Alert>
        <Button
          variant="destructive"
          onClick={handleCopyPK}
          disabled={isCopiedToClipboard}
        >
          Copiar clave privada al portapapeles
        </Button>
      </DialogContent>
    </Dialog>
  );
};
