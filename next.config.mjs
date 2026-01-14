/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable server actions for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
