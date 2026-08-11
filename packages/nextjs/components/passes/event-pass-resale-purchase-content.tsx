import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { formatUsdc } from "../../lib/event-pass-offers";

export type ResalePurchaseContentState =
  | "balance_unavailable"
  | "insufficient"
  | "stale"
  | "pending"
  | "success"
  | "failure";

function RetryButton({ onRetry }: { onRetry?: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="w-full rounded-xl border bg-background px-5 py-3 font-semibold"
    >
      Reintentar
    </button>
  );
}

export function EventPassResalePurchaseButton({
  priceAmountSubunits,
  onConfirm,
}: {
  priceAmountSubunits: string;
  onConfirm?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onConfirm}
      className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-primary/90"
    >
      Comprar por {formatUsdc(priceAmountSubunits)}
    </button>
  );
}

export function EventPassResalePurchaseContent({
  state,
  eventName,
  priceAmountSubunits,
  balanceAmountSubunits,
  onRetry,
}: {
  state: ResalePurchaseContentState;
  eventName: string;
  priceAmountSubunits: string;
  balanceAmountSubunits?: string | null;
  onRetry?: () => void;
}) {
  const price = BigInt(priceAmountSubunits);

  if (state === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm font-semibold">
        <LoaderCircle className="size-5 animate-spin" /> Confirmando tu
        compra...
      </div>
    );
  }
  if (state === "success") {
    return (
      <div
        role="status"
        className="flex gap-3 rounded-xl bg-primary/10 p-4 text-sm font-semibold"
      >
        <CheckCircle2 className="size-5 shrink-0" />
        <span>{eventName} ahora está en Mis pases.</span>
      </div>
    );
  }
  if (state === "stale") {
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" /> Esta reventa ya no está
          disponible o tu cuenta no es elegible. Es posible que otro comprador
          la haya completado primero. Verifica que tu correo electrónico esté
          verificado y que no cuentes ya con un Event Pass para este evento. No
          se te cobrará.
        </p>
        <a
          href="/marketplace"
          className="block w-full rounded-xl border bg-background px-5 py-3 text-center font-semibold"
        >
          Volver a Marketplace
        </a>
      </div>
    );
  }
  if (state === "failure") {
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" /> No pudimos completar esta
          compra, pero no se te cobrará. Reintenta para verificar el anuncio.
        </p>
        <RetryButton onRetry={onRetry} />
        <a
          href="/marketplace"
          className="block text-center text-sm font-bold underline underline-offset-4"
        >
          Volver a Marketplace
        </a>
      </div>
    );
  }
  if (state === "insufficient") {
    const balance = BigInt(balanceAmountSubunits ?? "0");
    const missing = price > balance ? price - balance : 0n;
    const missingAmount = formatUsdc(missing.toString()).replace(/ USDC$/, "");
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="rounded-xl bg-amber-500/10 p-3 text-sm font-semibold"
        >
          Necesitas {missingAmount} USDC más para comprar este Event Pass.
        </p>
        <dl className="grid grid-cols-2 gap-3 rounded-xl border p-3 text-sm">
          <div>
            <dt className="sr-only">Saldo</dt>
            <dd className="font-bold">
              Saldo disponible: {formatUsdc(balance.toString())}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Total</dt>
            <dd className="font-bold">
              Total: {formatUsdc(priceAmountSubunits)}
            </dd>
          </div>
        </dl>
        <RetryButton onRetry={onRetry} />
      </div>
    );
  }
  if (state === "balance_unavailable") {
    return (
      <div className="space-y-3">
        <p
          role="alert"
          className="rounded-xl bg-amber-500/10 p-3 text-sm font-semibold"
        >
          No pudimos consultar tu saldo de USDC. Inténtalo de nuevo.
        </p>
        <RetryButton onRetry={onRetry} />
      </div>
    );
  }
  return null;
}
