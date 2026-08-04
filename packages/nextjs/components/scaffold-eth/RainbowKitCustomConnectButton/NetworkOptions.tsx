import { useTheme } from "next-themes";
import { useAccount, useSwitchChain } from "wagmi";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/solid";
import { DropdownMenuItem } from "~~/components/ui/dropdown-menu";
import { getNetworkColor } from "~~/hooks/scaffold-eth";
import { getTargetNetworks } from "~~/utils/scaffold-stylus";

const allowedNetworks = getTargetNetworks();

export const NetworkOptions = () => {
  const { switchChain } = useSwitchChain();
  const { chain } = useAccount();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  return (
    <>
      {allowedNetworks
        .filter(allowedNetwork => allowedNetwork.id !== chain?.id)
        .map(allowedNetwork => (
          <DropdownMenuItem
            key={allowedNetwork.id}
            onClick={() => {
              switchChain?.({ chainId: allowedNetwork.id });
            }}
          >
            <ArrowsRightLeftIcon />
            <span>
              Switch to{" "}
              <span
                style={{
                  color: getNetworkColor(allowedNetwork, isDarkMode),
                }}
              >
                {allowedNetwork.name}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
    </>
  );
};
