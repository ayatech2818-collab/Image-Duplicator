/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app is 100% client-side (no API routes, server actions, or SSR data
  // fetching), so we emit a fully static site into `out/`. That deploys on
  // Vercel — or any static host — with zero server runtime or config.
  output: "export",
  // Static export can't use the Next.js image optimizer; we only use raw <img>,
  // but keep this so adding next/image later won't break the export.
  images: { unoptimized: true },
  // Emit `out/index.html`, `out/404.html` style folders for clean static routing.
  trailingSlash: true,
};

export default nextConfig;
