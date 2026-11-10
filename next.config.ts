import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads the session, so server redirects beat cached shells (ADR-032).
  cacheComponents: false,
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
