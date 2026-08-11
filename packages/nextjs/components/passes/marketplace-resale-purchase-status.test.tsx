// @ts-ignore - react-dom/server types are provided at runtime
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarketplaceResalePurchaseStatus } from "./marketplace-resale-purchase-status";

describe("Marketplace resale onboarding status", () => {
  it.each([
    [
      "email_unverified",
      "Verifica tu correo electrónico",
      "verificación de Mint Up",
    ],
    ["blocked", "no puede realizar compras", "soporte de Mint Up"],
    ["own_listing", "Publicaste este Event Pass", "Administrar Mis pases"],
    ["already_has_event_pass", "Ya tienes un Event Pass activo", "Mis pases"],
    ["unavailable", "ya no está disponible", "Volver a Marketplace"],
  ] as const)(
    "explains %s without internal details",
    (status, reason, action) => {
      const html = renderToStaticMarkup(
        <MarketplaceResalePurchaseStatus status={status} />,
      );

      expect(html).toContain(reason);
      expect(html).toContain(action);
      expect(html.toLowerCase()).not.toMatch(
        /wallet|gas|hash|transaction|seller|token|0x/,
      );
    },
  );
});
