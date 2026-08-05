import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin, Ticket } from "lucide-react";

import type { EventPassOffer } from "~~/lib/event-pass-offers";
import { formatUsdc } from "~~/lib/event-pass-offers";
import { shouldOptimizeImage } from "~~/lib/image-optimization";

export function OfferCard({ offer }: { offer: EventPassOffer }) {
  return (
    <article className="group overflow-hidden rounded-3xl border bg-card shadow-sm transition-shadow hover:shadow-xl">
      <Link
        href={`/passes/${encodeURIComponent(offer.eventId)}`}
        className="block"
      >
        <div className="relative aspect-16/10 overflow-hidden bg-neutral-900">
          {offer.imageUrl ? (
            <Image
              src={offer.imageUrl}
              alt=""
              fill
              loading="eager"
              unoptimized={!shouldOptimizeImage(offer.imageUrl)}
              className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : null}
          <div className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-transparent" />
          <span className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
            Event Pass
          </span>
          <p className="absolute bottom-4 left-4 text-sm font-semibold text-white">
            {offer.remaining} remaining
          </p>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-heading text-2xl font-bold leading-tight">
              {offer.name}
            </h2>
            <ArrowUpRight className="mt-1 size-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" /> {offer.location}
          </p>
          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ticket className="size-4" /> One pass
            </span>
            <strong>{formatUsdc(offer.price.amountSubunits)}</strong>
          </div>
        </div>
      </Link>
    </article>
  );
}
