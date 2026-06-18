import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs"],
  // ESLint already runs in CI — skip during next build to avoid ESLint 8 / Next.js 15 incompatibility warnings
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      {
        source: "/dashboard/appointments",
        destination: "/dashboard/appointments/calendar",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Allowed connect-src origins: self + Cloudflare R2 presigned URLs
    const cspDirectives = [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for its runtime inline scripts; nonce support
      // would require a custom server — acceptable trade-off for this deployment target.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind generates inline styles; 'unsafe-inline' is required.
      "style-src 'self' 'unsafe-inline'",
      // R2 public bucket domain for uploaded files (logos, photos, consent docs)
      "img-src 'self' data: blob: *.r2.cloudflarestorage.com *.r2.dev",
      "font-src 'self' data:",
      "connect-src 'self'",
      // No frames allowed, including embedded PDFs from third-party origins
      "frame-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy",   value: cspDirectives },
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
