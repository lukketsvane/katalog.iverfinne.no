/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'yswmt0em8hyvljdk.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default nextConfig;
