// The app is fully client-side, so it is exported as static files.
// NEXT_PUBLIC_BASE_PATH is set when hosting under a sub-path (e.g. GitHub Pages).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
