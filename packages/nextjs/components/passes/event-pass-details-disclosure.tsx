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
  return new Intl.DateTimeFormat("es-PE", {
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
          Detalles
        </summary>
        <div className="border-t px-4 py-4 text-sm leading-6">
          <p>
            <strong>Periodo de venta:</strong>
            <br />
            Empieza el {dateTime(saleStartsAt, timezone)} (incluido)
            <br />
            Termina el {dateTime(saleEndsAt, timezone)} (excluido)
          </p>
          <p className="mt-3">
            <strong>Disponibles:</strong> quedan {remaining} de {capacity}
          </p>
          <p className="mt-3">
            <strong>Estado del evento:</strong>{" "}
            {lifecycle === "cancelled"
              ? "Cancelado"
              : "Programado, no cancelado"}
          </p>
          {availabilityReason ? (
            <p className="mt-3">
              <strong>Disponibilidad:</strong> {availabilityReason}
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
