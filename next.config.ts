import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents disabled on purpose: every page and route here is live data.
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
