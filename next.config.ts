import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve query-specific Explore HTML on the first response, including without JS.
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
