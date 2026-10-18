/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep recently visited pages in the client Router Cache so returning to a page
  // (back/forward, re-clicking a nav link) is instant instead of a fresh server hit.
  // Dynamic pages still refresh after the short window; auth pages revalidate quickly.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
