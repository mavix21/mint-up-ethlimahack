"use client";

import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { formatUnits } from "viem";
import { useBalance } from "wagmi";

import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { eventPassEnvironment } from "~~/contracts/eventPassEnvironment";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function TokenRow({
  symbol,
  balance,
  isLoading,
  isError,
  icon,
}: {
  symbol: string;
  balance?: string;
  isLoading: boolean;
  isError: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full border bg-card text-sm font-bold">
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold">{symbol}</p>
          <p className="text-xs text-muted-foreground">
            {symbol === "USDC" ? "USD Coin" : "Ether"}
          </p>
        </div>
      </div>
      <div className="text-right">
        {isLoading ? (
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        ) : isError ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <>
            <p className="font-mono text-[15px] font-bold tracking-tight">
              {balance}
            </p>
            <p className="text-xs text-muted-foreground">{symbol}</p>
          </>
        )}
      </div>
    </div>
  );
}

export function WalletCard({ address }: { address: `0x${string}` }) {
  const [copied, setCopied] = useState(false);
  const { targetNetwork } = useTargetNetwork();

  const {
    data: ethBalance,
    isLoading: ethLoading,
    isError: ethError,
  } = useBalance({
    address,
    chainId: targetNetwork.id,
    query: { refetchInterval: 10_000 },
  });

  const {
    data: usdcBalance,
    isLoading: usdcLoading,
    isError: usdcError,
  } = useBalance({
    address,
    chainId: targetNetwork.id,
    token: eventPassEnvironment.usdcAddress,
    query: { refetchInterval: 10_000 },
  });

  const ethDisplay = ethBalance
    ? formatAmount(ethBalance.value, ethBalance.decimals)
    : "0";
  const usdcDisplay = usdcBalance ? formatAmount(usdcBalance.value, 6) : "0";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback: select is not needed, toast fallback not required
    }
  }

  return (
    <div className="mx-auto w-full max-w-[420px]">
      {/* Phantom-style card */}
      <div className="overflow-hidden rounded-[2rem] border bg-card shadow-xl">
        {/* Header */}
        <div className="relative bg-primary p-6 text-primary-foreground sm:p-7">
          {/* subtle glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 size-40 rounded-full bg-primary-foreground/15 blur-2xl" />

          <div className="relative flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/75">
                Tu billetera
              </p>
            </div>
            <div className="ml-auto hidden items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary-foreground backdrop-blur sm:flex">
              <span className="size-2 rounded-full bg-primary-foreground shadow shadow-primary-foreground/50" />
              Activa
            </div>
          </div>

          {/* Address pill */}
          <div className="relative mt-6 flex items-center gap-3 rounded-2xl bg-white/95 p-3 pl-4 text-foreground shadow-lg backdrop-blur sm:p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Dirección
              </p>
              <p
                className="mt-0.5 truncate font-mono text-sm font-bold tracking-tight"
                title={address}
              >
                {shortAddress(address)}
              </p>
              <p
                className="truncate font-mono text-[11px] text-muted-foreground"
                title={address}
              >
                {address}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? "Copiada" : "Copiar dirección"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-xs font-bold text-background transition hover:bg-foreground/90 active:scale-[0.98]"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copiada" : "Copiar"}
            </button>
          </div>
        </div>

        {/* Balances */}
        <div className="space-y-3 p-4 sm:p-5">
          <p className="px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Saldos
          </p>
          <TokenRow
            symbol="USDC"
            balance={usdcDisplay}
            isLoading={usdcLoading}
            isError={usdcError}
            icon={
              <span className="text-[11px] font-black tracking-tight text-primary">
                $
              </span>
            }
          />
          <TokenRow
            symbol="ETH"
            balance={ethDisplay}
            isLoading={ethLoading}
            isError={ethError}
            icon={
              <span className="font-serif text-sm font-bold text-foreground">
                Ξ
              </span>
            }
          />
          <p className="px-1 pt-1 text-center text-xs leading-5 text-muted-foreground">
            USDC para pases · ETH para comisiones de red (patrocinadas)
          </p>
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center rounded-xl border bg-background px-4 py-3 text-sm font-bold transition-colors hover:bg-muted"
          >
            Agregar fondos con Circle
          </a>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Protegida con Face ID en este dispositivo.
      </p>
    </div>
  );
}

function formatAmount(value: bigint, decimals: number) {
  const raw = formatUnits(value, decimals);
  const [int, frac = ""] = raw.split(".");
  if (value === 0n) return "0";
  // Show up to 4 decimals for ETH, 2 for USDC — trim trailing zeros
  const maxFrac = decimals === 6 ? 2 : 4;
  const trimmed = frac.slice(0, maxFrac).replace(/0+$/, "");
  return trimmed ? `${int}.${trimmed}` : int;
}
