import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // With Next.js >= 16.4.1 a dev server that reuses the persistent Turbopack
  // cache left by an earlier dev server reloads the page endlessly, which
  // stalls the sequential Playwright runs. They start fresh instead.
  experimental: { turbopackFileSystemCacheForDev: process.env.PLAYWRIGHT_RUN !== '1' },

  // The app runs behind the custom same-port server in server.mjs, which
  // cannot be combined with `output: 'standalone'`.
  serverExternalPackages: ['better-sqlite3', 'ws'],

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
