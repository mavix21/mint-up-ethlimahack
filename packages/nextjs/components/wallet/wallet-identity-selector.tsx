"use client";

import { useState } from "react";
import { Link2, ShieldCheck, WalletCards } from "lucide-react";
import { WalletProofButton } from "~~/components/auth/wallet-proof-button";
import { CopyAddressButton } from "~~/components/wallet/copy-address-button";
import type { WalletOption } from "~~/lib/wallet-identities";

type WalletIdentitySelectorProps = {
  wallets: WalletOption[];
  origin: string;
  targetChainId: number;
  targetChainName: string;
};

function walletLabel(wallet: WalletOption) {
  return wallet.kind === "smart-account"
    ? "Cuenta inteligente"
    : "Externa vinculada";
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function WalletIdentitySelector({
  wallets,
  origin,
  targetChainId,
  targetChainName,
}: WalletIdentitySelectorProps) {
  const [selectedId, setSelectedId] = useState(wallets[0]?.id ?? "");
  const selected =
    wallets.find(wallet => wallet.id === selectedId) ?? wallets[0];
  const linkedAddresses = wallets
    .filter(wallet => wallet.kind === "linked")
    .map(wallet => wallet.address);

  return (
    <section className="mb-10 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="rounded-4xl border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Selector de billetera
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold">
              Elige una billetera verificada
            </h2>
          </div>
          <ShieldCheck className="size-6 text-primary" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {wallets.map(wallet => {
            const active = wallet.id === selected?.id;
            return (
              <button
                key={wallet.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(wallet.id)}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-base-300 hover:border-primary/50"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {wallet.kind === "smart-account" ? (
                    <WalletCards className="size-4" />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                  {walletLabel(wallet)}
                </span>
                <span className="mt-2 block font-mono text-xs text-base-content/65">
                  {shortAddress(wallet.address)}
                </span>
                {wallet.kind === "linked" ? (
                  <span className="mt-1 block text-xs text-base-content/50">
                    Cadena {wallet.chainId}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {selected ? (
          <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-base-200 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-base-content/55">
                Billetera {walletLabel(selected).toLowerCase()} seleccionada
              </p>
              <p className="mt-2 break-all font-mono text-sm font-semibold">
                {selected.address}
              </p>
            </div>
            <CopyAddressButton address={selected.address} />
          </div>
        ) : null}
      </div>

      <div className="rounded-4xl border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Billetera externa
        </p>
        <h2 className="mt-2 font-heading text-2xl font-bold">
          Vincular una billetera
        </h2>
        <p className="mb-5 mt-2 text-sm text-base-content/65">
          Firma una prueba nueva para agregar una dirección a esta cuenta. Solo
          conectar una billetera nunca la vincula.
        </p>
        <WalletProofButton
          intent="link"
          origin={origin}
          targetChainId={targetChainId}
          targetChainName={targetChainName}
          linkedAddresses={linkedAddresses}
        />
      </div>
    </section>
  );
}
