import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { formatUsdc } from "../../lib/event-pass-offers";
import { ProtectedPaymentExplanation } from "./protected-payment-explanation";

export function BiometricUnavailable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border bg-amber-500/10 p-4 text-sm"
    >
      <p className="font-bold">
        Face ID o la huella digital no están disponibles
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-xl border bg-background px-4 py-2 text-xs font-bold"
      >
        Reintentar
      </button>
    </div>
  );
}

type ReviewProps = {
  eventName: string;
  priceAmountSubunits: string;
  confirmDisabled: boolean;
  fundsWarning?: ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
};

export function EventPassPurchaseReview({
  eventName,
  priceAmountSubunits,
  confirmDisabled,
  fundsWarning,
  onConfirm,
  onCancel,
}: ReviewProps) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="font-bold">Revisión</p>
      <p className="text-sm font-semibold">Evento: {eventName}</p>
      <p className="text-lg font-black">
        Total: {formatUsdc(priceAmountSubunits)}
      </p>
      <ProtectedPaymentExplanation />
      {fundsWarning}
      <button
        type="button"
        disabled={confirmDisabled}
        onClick={onConfirm}
        className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
        aria-disabled={confirmDisabled}
      >
        Confirmar con Face ID o huella digital
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-xl border px-5 py-3 font-semibold"
      >
        Cancelar
      </button>
    </div>
  );
}

export function EventPassPurchaseError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="space-y-3">
      <p
        role="alert"
        className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" /> No pudimos obtener tu
        Event Pass. Inténtalo de nuevo.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="w-full rounded-xl border px-5 py-3 font-semibold"
      >
        Reintentar
      </button>
    </div>
  );
}

export function EventPassPurchaseSuccess({ eventName }: { eventName: string }) {
  return (
    <span>
      <strong>{eventName}</strong>
      <br />
      Tu Event Pass está confirmado.
    </span>
  );
}
