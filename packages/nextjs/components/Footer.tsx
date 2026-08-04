import Link from "next/link";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Faucet } from "~~/components/scaffold-eth";
import { Button } from "~~/components/ui/button";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { arbitrumNitro } from "~~/utils/scaffold-stylus/supportedChains";

/**
 * Site footer.
 */
export const Footer = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === arbitrumNitro.id;

  return (
    <footer className="mb-11 min-h-0 bg-background px-1 py-5 lg:mb-0">
      <div className="pointer-events-none fixed bottom-0 left-0 z-10 flex w-full items-center justify-between p-4">
        <div className="pointer-events-auto flex flex-col gap-2 md:flex-row">
          {isLocalNetwork ? (
            <>
              <Faucet />
              <Button render={<Link href="/blockexplorer" />} nativeButton={false} variant="outline">
                <MagnifyingGlassIcon />
                <span>Block Explorer</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex w-full justify-end gap-2">
        <Button
          render={<a href="https://github.com/Arb-Stylus/scaffold-stylus" target="_blank" rel="noreferrer" />}
          nativeButton={false}
          variant="outline"
          size="sm"
        >
          Fork me
        </Button>
        <Button
          render={<a href="https://t.me/arbitrum_stylus" target="_blank" rel="noreferrer" />}
          nativeButton={false}
          variant="outline"
          size="sm"
        >
          Support
        </Button>
      </div>
    </footer>
  );
};
