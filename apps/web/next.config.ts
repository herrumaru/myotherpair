import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@myotherpair/types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
