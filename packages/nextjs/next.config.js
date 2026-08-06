// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.PASSES_E2E_DIST_DIR ? ".next-e2e" : ".next",
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: true,

  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
};

module.exports = nextConfig;
