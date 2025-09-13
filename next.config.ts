import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'share.google',
        port: '',
        pathname: '/**',
      }
    ],
  },
  experimental: {
    allowedDevOrigins: [
        "https://6000-firebase-studio-1757122404018.cluster-c36dgv2kibakqwbbbsgmia3fny.cloudworkstations.dev",
    ]
  }
};

export default nextConfig;
