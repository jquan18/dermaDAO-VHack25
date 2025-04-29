/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['cloudflare-ipfs.com', 'images.unsplash.com', 'randomuser.me'],
  },
  output: 'standalone',
};

module.exports = nextConfig;