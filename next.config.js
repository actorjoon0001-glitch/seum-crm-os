/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // 관리 페이지는 항상 최신 데이터를 보여주도록 CDN/브라우저 캐시를 끔
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
          { key: "Netlify-CDN-Cache-Control", value: "no-store" },
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
