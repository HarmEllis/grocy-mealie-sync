import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
