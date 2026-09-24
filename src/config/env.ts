// Expo embeds EXPO_PUBLIC_* values in the client bundle. Keep secrets out of here.
// The defaults are what a store build uses — .env is git-ignored, so EAS never
// sees it. They name Convex Cloud (project "hooked", production), the same
// backend web/.env.production pins for the web app.
export const CONVEX_URL =
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "https://shocking-goldfinch-745.convex.cloud";

export const CONVEX_SITE_URL =
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "https://shocking-goldfinch-745.convex.site";

export const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL ?? "https://hookedcue.com";

export const WEB_APP_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://app.hookedcue.com";
