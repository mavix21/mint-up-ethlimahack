import { NetworkOptions } from "./NetworkOptions";
import { getAddress } from "viem";
import { Address } from "viem";
import { useAccount, useDisconnect } from "wagmi";
import {
  ArrowLeftEndOnRectangleIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  QrCodeIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { BlockieAvatar, isENS } from "~~/components/scaffold-eth";
import { Button } from "~~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~~/components/ui/dropdown-menu";
import { useCopyToClipboard } from "~~/hooks/scaffold-eth";
import { getTargetNetworks } from "~~/utils/scaffold-stylus";
import { arbitrumNitro } from "~~/utils/scaffold-stylus/supportedChains";

const BURNER_WALLET_ID = "burnerWallet";

const allowedNetworks = getTargetNetworks();

type AddressInfoDropdownProps = {
  address: Address;
  displayName: string;
  ensAvatar?: string;
  onSwitchAccount: () => void;
  onShowQRCode: () => void;
  onRevealBurnerPK: () => void;
};

export const AddressInfoDropdown = ({
  address,
  ensAvatar,
  displayName,
  onSwitchAccount,
  onShowQRCode,
  onRevealBurnerPK,
}: AddressInfoDropdownProps) => {
  const { disconnect } = useDisconnect();
  const { connector } = useAccount();
  const checkSumAddress = getAddress(address);

  const {
    copyToClipboard: copyAddressToClipboard,
    isCopiedToClipboard: isAddressCopiedToClipboard,
  } = useCopyToClipboard();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <BlockieAvatar
          address={checkSumAddress}
          size={24}
          ensImage={ensAvatar}
        />
        <span>
          {isENS(displayName)
            ? displayName
            : checkSumAddress.slice(0, 6) + "..." + checkSumAddress.slice(-4)}
        </span>
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          closeOnClick={false}
          onClick={() => copyAddressToClipboard(checkSumAddress)}
        >
          {isAddressCopiedToClipboard ? (
            <CheckCircleIcon />
          ) : (
            <DocumentDuplicateIcon />
          )}
          <span>
            {isAddressCopiedToClipboard ? "¡Copiada!" : "Copiar dirección"}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowQRCode}>
          <QrCodeIcon />
          <span>Ver código QR</span>
        </DropdownMenuItem>
        {allowedNetworks.some(network => network.id === arbitrumNitro.id) && (
          <DropdownMenuItem onClick={onSwitchAccount}>
            <UserCircleIcon />
            <span>Cambiar cuenta</span>
          </DropdownMenuItem>
        )}
        {allowedNetworks.length > 1 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowsRightLeftIcon />
              <span>Cambiar red</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <NetworkOptions />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {connector?.id === BURNER_WALLET_ID ? (
          <DropdownMenuItem onClick={onRevealBurnerPK}>
            <EyeIcon />
            <span>Mostrar clave privada</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => disconnect()}>
          <ArrowLeftEndOnRectangleIcon />
          <span>Desconectar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
