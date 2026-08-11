import {
  eventPassChainName,
  eventPassEnvironment,
} from "~~/contracts/eventPassEnvironment";
import { getEventPassOffer } from "~~/lib/event-pass-offer-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const offer = await getEventPassOffer(eventId);

  if (!offer) {
    return Response.json(
      { message: "This Event Pass is unavailable." },
      { status: 404 },
    );
  }

  return Response.json({
    offer: {
      eventId: offer.eventId,
      eventName: offer.name,
      eventIdentifier: offer.eventIdentifier,
      priceAmountSubunits: offer.price.amountSubunits,
      remaining: offer.remaining,
      revenueRecipient: offer.revenueRecipient,
      availability: offer.availability,
    },
    environment: {
      chainId: eventPassEnvironment.chainId,
      chainName: eventPassChainName,
      contractAddress: eventPassEnvironment.eventPassAddress,
      usdcAddress: eventPassEnvironment.usdcAddress,
    },
  });
}
