export function shouldOptimizeImage(src?: string) {
  if (!src || src.startsWith("/")) return true;
  try {
    const url = new URL(src);
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    return url.origin === (convexUrl ? new URL(convexUrl).origin : undefined);
  } catch {
    return false;
  }
}
