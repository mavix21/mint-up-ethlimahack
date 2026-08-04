import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Address as AddressType } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~~/components/ui/dialog";

type AddressQRCodeModalProps = {
  address: AddressType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const AddressQRCodeModal = ({ address, open, onOpenChange }: AddressQRCodeModalProps) => {
  useEffect(() => () => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wallet address</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6">
          <QRCodeSVG value={address} size={256} />
          <Address address={address} format="long" disableAddressLink onlyEnsOrAddress />
        </div>
      </DialogContent>
    </Dialog>
  );
};
