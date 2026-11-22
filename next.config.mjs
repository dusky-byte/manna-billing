/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Next 16 (Turbopack): sql.js probes for Node modules, so stub them in the browser bundle.
  turbopack: {
    resolveAlias: {
      fs: { browser: "./src/lib/empty.ts" },
      path: { browser: "./src/lib/empty.ts" },
      crypto: { browser: "./src/lib/empty.ts" },
    },
  },
  // Same stubs if you run with --webpack.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    }
    return config;
  },
};