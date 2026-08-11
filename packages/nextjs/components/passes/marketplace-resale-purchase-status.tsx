import Link from "next/link";
import { CircleAlert } from "lucide-react";

import type { ResalePurchaseAccessStatus } from "~~/lib/event-pass-resale-api";

type BlockedStatus = Exclude<
  ResalePurchaseAccessStatus,
  "eligible" | "account_unprotected"
>;

export function MarketplaceResalePurchaseStatus({
  status,
}: {
  status: BlockedStatus;
}) {
  const content = {
    email_unverified: {
      title: "Verifica tu correo electrónico para continuar",
      detail:
        "Abre el mensaje de verificación de Mint Up, verifica tu correo electrónico y vuelve a esta página.",
      action: null,
    },
    blocked: {
      title: "Tu cuenta de Mint Up no puede realizar compras",
      detail: "Contacta al soporte de Mint Up si crees que es un error.",
      action: null,
    },
    own_listing: {
      title: "Publicaste este Event Pass",
      detail: "No puedes comprar tu propio anuncio de reventa.",
      action: { href: "/my-passes", label: "Administrar Mis pases" },
    },
    already_has_event_pass: {
      title: "Ya tienes un Event Pass activo para este evento",
      detail:
        "Solo se permite un Event Pass activo por persona para cada evento.",
      action: { href: "/my-passes", label: "Ver Mis pases" },
    },
    unavailable: {
      title: "Esta reventa ya no está disponible",
      detail: "No se te cobrará. Elige otra opción disponible.",
      action: { href: "/marketplace", label: "Volver a Marketplace" },
    },
  }[status];

  return (
    <div className="space-y-4" role="alert">
      <div className="rounded-2xl bg-amber-500/10 p-4">
        <div className="flex gap-3">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">{content.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {content.detail}
            </p>
          </div>
        </div>
      </div>
      {content.action ? (
        <Link
          href={content.action.href}
          className="block w-full rounded-xl border bg-background px-5 py-3 text-center font-semibold"
        >
          {content.action.label}
        </Link>
      ) : null}
    </div>
  );
}
