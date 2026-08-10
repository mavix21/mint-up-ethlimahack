import { ProtectedPaymentExplanation } from "./protected-payment-explanation";

type Props = {
  saleStartsAt: number;
  saleEndsAt: number;
  timezone: string;
  remaining: number;
  capacity: number;
  lifecycle: "scheduled" | "cancelled";
  availabilityReason: string | null;
};

function dateTime(value: number, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timezone,
  }).format(value);
}

export function EventPassDetailsDisclosure({
  saleStartsAt,
  saleEndsAt,
  timezone,
  remaining,
  capacity,
  lifecycle,
  availabilityReason,
}: Props) {
  return (
    <div className="mt-6">
      <ProtectedPaymentExplanation />
      <details id="event-pass-details" className="mt-3 rounded-2xl border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
          Details
        </summary>
        <div className="border-t px-4 py-4 text-sm leading-6">
          <p>
            <strong>Sales window:</strong>
            <br />
            Starts {dateTime(saleStartsAt, timezone)} (inclusive)
            <br />
            Ends {dateTime(saleEndsAt, timezone)} (exclusive)
          </p>
          <p className="mt-3">
            <strong>Remaining:</strong> {remaining} of {capacity} remaining
          </p>
          <p className="mt-3">
            <strong>Event status:</strong>{" "}
            {lifecycle === "cancelled"
              ? "Cancelled"
              : "Scheduled, not cancelled"}
          </p>
          {availabilityReason ? (
            <p className="mt-3">
              <strong>Availability:</strong> {availabilityReason}
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
