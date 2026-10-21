import sentryConfig from "@sentry/nextjs/config";

const { withSentryConfig } = sentryConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep recently visited pages in the client Router Cache so returning to a page
  // (back/forward, re-clicking a nav link) is instant instead of a fresh server hit.
  // Dynamic pages still refresh after the short window; auth pages revalidate quickly.
  experimental: {
    instrumentationHook: true,
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  automaticVercelMonitors: false,
});
