import { CircleAlert, LoaderCircle } from "lucide-react";

import { recipientUnavailableMessage } from "../../lib/event-pass-transfer-schema";

const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50";
const outlineButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-full border bg-background px-4 text-sm font-bold";

type TransferContentProps = {
  state: "form" | "review" | "pending" | "success" | "failure";
  eventName: string;
  recipientName?: string;
  recipientEmail?: string;
  failure?: "recipient" | "operation";
  inputId?: string;
  email?: string;
  onEmailChange?: (email: string) => void;
  onPrepare?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onDone?: () => void;
};

export function EventPassTransferContent(props: TransferContentProps) {
  if (props.state === "form") {
    const inputId = props.inputId ?? "transfer-recipient";
    return (
      <form
        className="space-y-4"
        onSubmit={event => {
          event.preventDefault();
          props.onPrepare?.();
        }}
      >
        <div>
          <label htmlFor={inputId} className="text-sm font-bold">
            Correo electrónico del destinatario
          </label>
          <input
            id={inputId}
            name="recipientEmail"
            type="email"
            autoComplete="email"
            required
            value={props.email}
            onChange={event => props.onEmailChange?.(event.target.value)}
            className="mt-2 h-10 w-full rounded-2xl border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="name@example.com"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={outlineButtonClass}
            onClick={props.onCancel}
          >
            Cancelar
          </button>
          <button type="submit" className={buttonClass}>
            Continuar
          </button>
        </div>
      </form>
    );
  }

  if (props.state === "review") {
    return (
      <div className="space-y-4">
        <dl className="grid gap-3 rounded-2xl bg-muted/60 p-4">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Evento
            </dt>
            <dd className="mt-1 font-semibold">{props.eventName}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Destinatario
            </dt>
            <dd className="mt-1 font-semibold">{props.recipientName}</dd>
            <dd className="text-sm text-muted-foreground">
              {props.recipientEmail}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          Transferencia gratuita. Recibirá el Event Pass en cuanto se confirme.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={outlineButtonClass}
            onClick={props.onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={props.onConfirm}
          >
            Confirmar con Face ID o huella digital
          </button>
        </div>
      </div>
    );
  }

  if (props.state === "pending") {
    return (
      <div role="status" className="flex items-center gap-3 py-3">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        <div>
          <p className="font-bold">Confirmando tu transferencia</p>
          <p className="text-sm text-muted-foreground">
            Mantén esta ventana abierta hasta que se complete.
          </p>
        </div>
      </div>
    );
  }

  if (props.state === "success") {
    return (
      <div className="space-y-4">
        <p className="font-bold">
          {props.eventName} se transfirió a {props.recipientName}.
        </p>
        <p className="text-sm text-muted-foreground">
          El Event Pass ahora está en sus pases.
        </p>
        <button
          type="button"
          className={`${buttonClass} w-full`}
          onClick={props.onDone}
        >
          Listo
        </button>
      </div>
    );
  }

  const recipientFailure = props.failure === "recipient";
  return (
    <div className="space-y-4">
      <p
        role="alert"
        className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {recipientFailure
          ? recipientUnavailableMessage
          : "No pudimos completar la transferencia. Inténtalo de nuevo."}
      </p>
      <button
        type="button"
        className={outlineButtonClass}
        onClick={props.onRetry}
      >
        Reintentar
      </button>
    </div>
  );
}
