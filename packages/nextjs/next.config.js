// @ts-check
const convexImagePattern = new URL("/**", process.env.NEXT_PUBLIC_CONVEX_URL);

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.PASSES_E2E_DIST_DIR ? ".next-e2e" : ".next",
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: true,

  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75],
    remotePatterns: [convexImagePattern],
  },

  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
};

module.exports = nextConfig;
