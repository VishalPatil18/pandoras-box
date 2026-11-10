import type { NextConfig } from "next";

// No other site may frame the app, so Log out and New fact can't be clickjacked.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // Every page reads the session, so server redirects beat cached shells (ADR-032).
  cacheComponents: false,
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
