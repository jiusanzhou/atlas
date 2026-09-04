import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with only the traced runtime deps, which is what the
  // Dockerfile ships instead of a full node_modules.
  output: "standalone",
};

export default nextConfig;
