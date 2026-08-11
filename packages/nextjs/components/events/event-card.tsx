"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { createContext, use } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~~/components/ui/card";
import { shouldOptimizeImage } from "~~/lib/image-optimization";
import { cn } from "~~/lib/utils";

interface EventCardContextValue {
  imageUrl?: string;
  title?: string;
  description?: string;
}
const EventCardContext = createContext<EventCardContextValue | null>(null);
function useEventCardContext() {
  return use(EventCardContext);
}

interface EventCardRootProps {
  children: ReactNode;
  className?: string;
  size?: "default" | "sm";
  context?: EventCardContextValue;
}
type EventCardMediaRootProps = EventCardRootProps;
type EventCardListRootProps = Omit<EventCardRootProps, "size">;

function EventCardFrame({
  children,
  className,
  size = "default",
  context,
}: EventCardRootProps) {
  return (
    <EventCardContext.Provider value={context ?? null}>
      <Card size={size} className={cn("transition-transform", className)}>
        {children}
      </Card>
    </EventCardContext.Provider>
  );
}
function EventCardRoot(props: EventCardRootProps) {
  return <EventCardFrame {...props} />;
}
function EventCardMediaRoot({ className, ...props }: EventCardMediaRootProps) {
  return <EventCardFrame className={cn("pt-0", className)} {...props} />;
}
function EventCardListRoot({ className, ...props }: EventCardListRootProps) {
  return (
    <EventCardFrame
      className={cn("flex-row items-start gap-3 rounded-3xl p-2", className)}
      size="sm"
      {...props}
    />
  );
}

interface EventCardImageProps {
  src?: string;
  alt?: string;
  className?: string;
  aspectRatio?: "video" | "square" | "portrait";
  children?: ReactNode;
}
function EventCardImage({
  src,
  alt,
  className,
  aspectRatio = "video",
  children,
}: EventCardImageProps) {
  const context = useEventCardContext();
  const imageSrc = src ?? context?.imageUrl;
  const optimize = shouldOptimizeImage(imageSrc);
  const ratios = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[4/3]",
  };
  return (
    <div
      className={cn("relative overflow-hidden", ratios[aspectRatio], className)}
    >
      <Image
        src={imageSrc || "/logo.svg"}
        alt={alt ?? context?.title ?? "Imagen del evento"}
        fill
        quality={optimize ? 60 : undefined}
        sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
        className="object-cover"
        unoptimized={!optimize}
      />
      {children}
    </div>
  );
}
function EventCardListImage({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const context = useEventCardContext();
  const optimize = shouldOptimizeImage(context?.imageUrl);
  return (
    <div
      className={cn(
        "relative size-24 shrink-0 overflow-hidden rounded-2xl bg-muted",
        className,
      )}
    >
      <Image
        src={context?.imageUrl || "/logo.svg"}
        alt={context?.title ?? "Imagen del evento"}
        fill
        quality={optimize ? 60 : undefined}
        sizes="(min-width: 768px) 144px, 96px"
        className="object-cover"
        unoptimized={!optimize}
      />
      {children}
    </div>
  );
}
function EventCardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <CardHeader className={className}>{children}</CardHeader>;
}
function EventCardTitle({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const context = useEventCardContext();
  return (
    <CardTitle className={cn("text-lg font-semibold", className)}>
      {children ?? context?.title}
    </CardTitle>
  );
}
function EventCardListTitle() {
  const context = useEventCardContext();
  return (
    <CardTitle className="line-clamp-2 text-base leading-tight font-semibold">
      {context?.title}
    </CardTitle>
  );
}
function EventCardDescription({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const context = useEventCardContext();
  const description = children ?? context?.description;
  return description ? (
    <CardDescription className={className}>{description}</CardDescription>
  ) : null;
}
function EventCardAction({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <CardAction className={className}>{children}</CardAction>;
}
function EventCardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <CardContent className={className}>{children}</CardContent>;
}
function EventCardListContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1 py-0.5", className)}>
      {children}
    </div>
  );
}

export const EventCard = {
  Root: EventCardRoot,
  MediaRoot: EventCardMediaRoot,
  ListRoot: EventCardListRoot,
  Image: EventCardImage,
  ListImage: EventCardListImage,
  Header: EventCardHeader,
  Title: EventCardTitle,
  ListTitle: EventCardListTitle,
  Description: EventCardDescription,
  Action: EventCardAction,
  Content: EventCardContent,
  ListContent: EventCardListContent,
};
export {
  EventCardAction,
  EventCardContent,
  EventCardDescription,
  EventCardImage,
  EventCardListContent,
  EventCardListImage,
  EventCardListRoot,
  EventCardListTitle,
  EventCardMediaRoot,
  EventCardRoot,
  EventCardTitle,
};
export type {
  EventCardContextValue,
  EventCardImageProps,
  EventCardListRootProps,
  EventCardMediaRootProps,
  EventCardRootProps,
};
