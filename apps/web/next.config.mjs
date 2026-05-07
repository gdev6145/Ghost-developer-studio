/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@ghost/ui',
    '@ghost/state',
    '@ghost/collaboration',
    '@ghost/editor',
    '@ghost/protocol',
    '@ghost/shared',
  ],
}

export default nextConfig
