/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Avatar Lark di-serve dari CDN Feishu/Lark
    remotePatterns: [
      { protocol: 'https', hostname: '**.feishucdn.com' },
      { protocol: 'https', hostname: '**.larksuitecdn.com' },
      { protocol: 'https', hostname: '**.larkoffice.com' },
      { protocol: 'https', hostname: '**.feishu.cn' },
    ],
  },
};

export default nextConfig;
