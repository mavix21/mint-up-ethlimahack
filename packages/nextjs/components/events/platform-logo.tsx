import type { ReactNode } from "react";
import Image from "next/image";

type Platform = "luma" | "mintup" | "eventbrite" | "meetup" | "other";
const platformLogos: Record<Platform, ReactNode> = {
  luma: (
    <svg viewBox="0 0 133 134" fill="none">
      <path
        fill="currentColor"
        d="M133 67C96.282 67 66.5 36.994 66.5 0c0 36.994-29.782 67-66.5 67 36.718 0 66.5 30.006 66.5 67 0-36.994 29.782-67 66.5-67"
      />
    </svg>
  ),
  mintup: (
    <Image
      src="/logo.png"
      alt=""
      width={48}
      height={48}
      className="size-full object-contain"
    />
  ),
  eventbrite: <span className="font-bold text-[#ee543d]">e</span>,
  meetup: <span className="font-bold text-[#ff4a79]">m</span>,
  other: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
};

export function PlatformLogo({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  return <span className={className}>{platformLogos[platform]}</span>;
}
