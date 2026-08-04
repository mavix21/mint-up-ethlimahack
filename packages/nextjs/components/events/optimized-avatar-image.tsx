import type { ComponentProps } from "react";
import { getImageProps } from "next/image";
import { AvatarImage } from "~~/components/ui/avatar";
import { shouldOptimizeImage } from "~~/lib/image-optimization";

type Props = Pick<ComponentProps<typeof AvatarImage>, "alt" | "className"> & { sizes?: string; src?: string };

export function OptimizedAvatarImage({ alt, className, sizes = "48px", src }: Props) {
  if (!src) return <AvatarImage alt={alt} className={className} />;
  const optimize = shouldOptimizeImage(src);
  const { props } = getImageProps({
    src,
    alt: alt ?? "",
    fill: true,
    quality: optimize ? 60 : undefined,
    sizes,
    unoptimized: !optimize,
  });
  return <AvatarImage {...props} className={className} />;
}
