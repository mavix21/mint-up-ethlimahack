import { Address } from "viem";
import { Alert, AlertDescription, AlertTitle } from "~~/components/ui/alert";

const ADMIN = "0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E";
const BUYER = "0xDD09b55496EaA3cFAe23137ABDeA52a9a979B70e";
const REVENUE_RECIPIENT = "0xE9cB1563bE49002383D08386ee287aF7BAD08c3b";
const CHECK_IN_OPERATOR = "0x838d568Ffb16BC74083e88fd769df85E8d3afcE6";
const EVENT_ID =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0001";

const Value = ({ children }: { children: string }) => (
  <code className="break-all rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
    {children}
  </code>
);

export function LocalTestingGuide({
  eventPass,
  usdc,
}: {
  eventPass: Address;
  usdc: Address;
}) {
  return (
    <Alert className="w-full max-w-7xl border-primary/30 bg-primary/5">
      <AlertTitle>Flujo local para comprar un Event Pass</AlertTitle>
      <AlertDescription className="space-y-4 text-sm">
        <p>
          Event Pass: <Value>{eventPass}</Value> · Mock USDC:{" "}
          <Value>{usdc}</Value>
        </p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            Selecciona la cuenta admin <Value>{ADMIN}</Value>. En{" "}
            <strong>mint-up-event-pass</strong>, ejecuta
            <strong> registerEvent</strong> con event ID{" "}
            <Value>{EVENT_ID}</Value>, precio <Value>25000000</Value>, supply
            <Value>10</Value>, sale start <Value>0</Value>, sale end{" "}
            <Value>4102444800</Value>, ventas y transferencias activas,
            recipient <Value>{REVENUE_RECIPIENT}</Value> y operador
            <Value>{CHECK_IN_OPERATOR}</Value>. Incrementa el sufijo del event
            ID si ya lo registraste.
          </li>
          <li>
            Cambia a buyer <Value>{BUYER}</Value>. En <strong>mock-usdc</strong>
            , ejecuta <strong>mint</strong> con buyer como destino y{" "}
            <Value>100000000</Value> como amount.
          </li>
          <li>
            Todavía en <strong>mock-usdc</strong>, ejecuta{" "}
            <strong>approve</strong> con spender
            <Value>{eventPass}</Value> y amount <Value>25000000</Value>.
          </li>
          <li>
            Vuelve a <strong>mint-up-event-pass</strong> y ejecuta{" "}
            <strong>purchase</strong> con el mismo event ID. Confirma el
            resultado con <strong>eventInfo</strong> y <strong>passInfo</strong>{" "}
            en la pestaña Read.
          </li>
        </ol>
        <p>
          Cada reinicio de Nitro borra el estado. Ejecuta{" "}
          <Value>yarn deploy</Value> y reinicia el frontend antes de probar.
          Para validar todo el ciclo automáticamente usa{" "}
          <Value>yarn test:local</Value>.
        </p>
      </AlertDescription>
    </Alert>
  );
}
