import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native addon and Prisma's engine ships .node binaries —
  // both must be required at runtime rather than bundled by webpack.
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@prisma/client",
  ],

  // Renders are uploaded as multipart; the default 1 MB body cap is far too
  // small for a 4K facade screenshot.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
