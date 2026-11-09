import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve query-specific Explore HTML on the first response, including without JS.
  cacheComponents: false,
  async redirects() {
    const origin = process.env.APP_ORIGIN;
    if (!origin || new URL(origin).hostname !== "127.0.0.1") return [];
    return [{
      source: "/:path*",
      has: [{ type: "host", value: "localhost" }],
      destination: `${origin}/:path*`,
      permanent: false,
    }];
  },
  logging: { incomingRequests: { ignore: [/\/auth\/confirm/] } },
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
