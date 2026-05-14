import type { NextConfig } from 'next';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import packageJson from './package.json';

/**
 * Security headers configuration
 * Addresses CVE-2025-55182 and CVE-2025-66478
 */
// API connect origin for the CSP `connect-src` directive.
//
// When NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_BACKEND_BASE_URL) is set at build
// time, we lock the CSP to that explicit origin. When it is NOT set - which is
// the LAN deployment case where the runtime client resolves the API base from
// `window.location.hostname:8000` - we widen `connect-src` to allow http: and
// https: origins. Without this, the browser would block the runtime-resolved
// XHR with a CSP violation.
const explicitApiOrigin =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
const connectSrc = explicitApiOrigin
  ? `'self' ${explicitApiOrigin}`
  : "'self' http: https:";

const rootVersionPath = resolve(process.cwd(), '..', 'VERSION');
const clientVersion = existsSync(rootVersionPath)
  ? readFileSync(rootVersionPath, 'utf8').trim()
  : packageJson.version;

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
    ].join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
];

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Inject product version from root VERSION at build time
  env: {
    NEXT_PUBLIC_CLIENT_VERSION: clientVersion,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
