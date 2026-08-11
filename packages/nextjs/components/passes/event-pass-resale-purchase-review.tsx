import { ShieldCheck } from "lucide-react";

import { formatUsdc } from "../../lib/event-pass-offers";

export function EventPassResalePurchaseReview({
  eventName,
  priceAmountSubunits,
  originalProtectedAmountSubunits,
  balanceAmountSubunits,
}: {
  eventName: string;
  priceAmountSubunits: string;
  originalProtectedAmountSubunits: string;
  balanceAmountSubunits: string;
}) {
  const price = formatUsdc(priceAmountSubunits);
  const protectedPrice = formatUsdc(originalProtectedAmountSubunits);
  const balance = formatUsdc(balanceAmountSubunits);
  return (
    <>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Reventa
        </p>
        <h3 className="mt-2 font-heading text-xl font-black">{eventName}</h3>
      </div>
      <p className="text-2xl font-black">Total: {price}</p>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border p-4 text-sm">
        <div>
          <dt className="sr-only">Saldo</dt>
          <dd className="font-bold">Saldo disponible: {balance}</dd>
        </div>
        <div>
          <dt className="sr-only">Comisión</dt>
          <dd className="font-bold">Comisión de Mint Up: 9% incluido</dd>
        </div>
      </dl>
      <div className="flex gap-3 rounded-xl bg-muted/60 p-4 text-sm leading-6">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <p>
          Pago protegido: {protectedPrice}. Si el evento se cancela, el titular
          actual puede recibir este importe original, no el precio de reventa.
        </p>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Esta compra es definitiva. Una confirmación con Face ID o huella digital
        autoriza este Event Pass y el total exacto. El éxito solo aparece
        después de verificarse en Mis pases.
      </p>
    </>
  );
}

export function EventPassResalePurchaseLoadError() {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p role="alert" className="text-sm font-semibold">
        No pudimos cargar esta reventa. Inténtalo de nuevo.
      </p>
      <a
        href="/marketplace"
        className="inline-flex rounded-xl border px-4 py-2 text-sm font-bold"
      >
        Reintentar
      </a>
    </div>
  );
}
