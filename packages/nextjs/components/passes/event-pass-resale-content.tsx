import { CircleAlert, LoaderCircle } from "lucide-react";

export type ResaleAction = "create" | "replace" | "withdraw";
export type ResaleContentState =
  "form" | "review" | "pending" | "success" | "failure" | "unavailable";

const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50";
const outlineButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-full border bg-background px-4 text-sm font-bold disabled:opacity-50";

type Props = {
  state: ResaleContentState;
  eventName: string;
  action?: ResaleAction;
  price?: string;
  fee?: string;
  net?: string;
  maximumPrice?: string;
  failure?: "validation" | "operation";
  priceInputId?: string;
  onPriceChange?: (value: string) => void;
  onPrepare?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onDone?: () => void;
};

function actionLabel(action?: ResaleAction) {
  if (action === "replace") return "Update listing";
  if (action === "withdraw") return "Remove listing";
  return "Create listing";
}

export function EventPassResaleContent(props: Props) {
  if (props.state === "form") {
    const priceInputId = props.priceInputId ?? "resale-price";
    return (
      <form
        className="space-y-4"
        onSubmit={event => {
          event.preventDefault();
          props.onPrepare?.();
        }}
      >
        <div>
          <label htmlFor={priceInputId} className="text-sm font-bold">
            Price in USDC
          </label>
          <input
            id={priceInputId}
            name="price"
            type="text"
            inputMode="decimal"
            required
            value={props.price}
            onChange={event => props.onPriceChange?.(event.target.value)}
            className="mt-2 h-10 w-full rounded-2xl border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="25.00"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Enter a positive amount with up to 6 decimals
            {props.maximumPrice ? `, up to ${props.maximumPrice}` : ""}.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={outlineButtonClass}
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button type="submit" className={buttonClass}>
            Continue
          </button>
        </div>
      </form>
    );
  }

  if (props.state === "review") {
    const withdrawal = props.action === "withdraw";
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-muted/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {actionLabel(props.action)}
          </p>
          <p className="mt-1 font-semibold">{props.eventName}</p>
          {props.price && !withdrawal ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Listing price</dt>
                <dd className="font-bold">{props.price} USDC</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>9% marketplace fee</dt>
                <dd>{props.fee}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t pt-2">
                <dt>You receive (91%)</dt>
                <dd className="font-bold">{props.net}</dd>
              </div>
            </dl>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {withdrawal
            ? "You keep your Event Pass. No USDC moves."
            : "Your Pass resale listing becomes public only after confirmation is verified."}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={outlineButtonClass}
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={props.onConfirm}
          >
            Confirm with Face ID or fingerprint
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
          <p className="font-bold">Confirming your listing</p>
          <p className="text-sm text-muted-foreground">
            Keep this window open until it is complete.
          </p>
        </div>
      </div>
    );
  }

  if (props.state === "success") {
    return (
      <div className="space-y-4">
        <p className="font-bold">
          {props.action === "withdraw"
            ? "Your listing has been removed."
            : props.action === "replace"
              ? "Your listing has been updated."
              : "Your listing is public."}
        </p>
        <button
          type="button"
          className={`${buttonClass} w-full`}
          onClick={props.onDone}
        >
          Done
        </button>
      </div>
    );
  }

  if (props.state === "unavailable") {
    return (
      <div className="rounded-xl bg-muted/60 p-3 text-sm">
        <p className="font-bold">Listing unavailable</p>
        <p className="text-muted-foreground">
          This listing can no longer be changed.
        </p>
      </div>
    );
  }

  const message =
    props.failure === "validation"
      ? "Enter a positive USDC price with up to 6 decimals that does not exceed your protected payment."
      : "We couldn't complete this listing. Try again.";
  return (
    <div className="space-y-4">
      <p
        role="alert"
        className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {message}
      </p>
      <button
        type="button"
        className={outlineButtonClass}
        onClick={props.onRetry}
      >
        Retry
      </button>
    </div>
  );
}
