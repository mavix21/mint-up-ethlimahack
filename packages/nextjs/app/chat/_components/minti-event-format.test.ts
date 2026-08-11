import { describe, expect, it } from "vitest";

import type { MintiEvent } from "~~/lib/mint-up-api";
import { formatEventLocation, formatEventPrice } from "./minti-event-format";

const event = {
  format: "in-person",
  price: { kinds: ["unknown"] },
  location: { district: "Miraflores" },
} as MintiEvent;

describe("authoritative Minti event formatting", () => {
  it("does not invent a price when the projection has none", () => {
    expect(formatEventPrice(event)).toBe("Precio no disponible");
  });

  it("formats normalized ranges as USD", () => {
    expect(
      formatEventPrice({
        ...event,
        price: { kinds: ["paid"], minUsd: 10, maxUsd: 18 },
      }),
    ).toBe("USD 10.00 - USD 18.00");
  });

  it("uses the authoritative online format before physical location fields", () => {
    expect(formatEventLocation({ ...event, format: "online" })).toBe(
      "En línea",
    );
  });
});
