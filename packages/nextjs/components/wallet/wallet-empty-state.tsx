"use client";

import { ShieldCheck } from "lucide-react";
import { WalletCreateButton } from "./wallet-create-button";

export function WalletEmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-130 flex-col items-center px-5 py-10 text-center sm:py-16">
      <div className="flex size-18 items-center justify-center rounded-[1.5rem] bg-primary-foreground/10 text-white shadow-lg shadow-violet-600/20">
        <ShieldCheck className="size-8" />
      </div>
      <h1 className="mt-6 font-heading text-[28px] font-black tracking-tight text-foreground sm:text-[34px]">
        Tus Event Pass, protegidos
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-6 text-muted-foreground">
        Un toque para crear tu pase seguro. La próxima vez, solo usa Face ID.
      </p>

      <div className="mt-8 w-full">
        <WalletCreateButton />
      </div>

      <p className="mt-6 max-w-xs text-xs leading-5 text-muted-foreground">
        Nada más que recordar. Tu dispositivo lo mantiene seguro.
      </p>
    </div>
  );
}
