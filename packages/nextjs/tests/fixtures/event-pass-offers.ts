export const eligibleOfferPayload = {
  eventId: "event_eth_lima_2026",
  ticketTypeId: "ticket_general",
  ticketTypeKind: "eventPass",
  eventIdentifier:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  name: "ETH Lima 2026",
  description: "A gathering for Ethereum builders in Latin America.",
  imageUrl: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678",
  startTime: Date.UTC(2026, 7, 8, 14),
  endTime: Date.UTC(2026, 7, 9, 2),
  timezone: "America/Lima",
  location: "Centro de Convenciones de Lima",
  organizerName: "ETH Lima",
  publication: "published",
  lifecycle: "scheduled",
  configuration: "active",
  contractSales: "enabled",
  onchainTicketTypeCount: 1,
  paymentAsset: "USDC",
  paymentAssetDecimals: 6,
  pricing: "fixed",
  priceAmountSubunits: "25000000",
  pricePhaseCount: 0,
  approval: "immediate",
  saleStartsAt: Date.UTC(2026, 6, 1),
  saleEndsAt: Date.UTC(2026, 7, 8, 14),
  capacity: 250,
  remaining: 37,
  revenueRecipient: "0x2222222222222222222222222222222222222222",
} as const;

export function offerPayload(patch: Record<string, unknown>) {
  return { ...eligibleOfferPayload, ...patch };
}
