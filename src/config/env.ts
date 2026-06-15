// Expo embeds EXPO_PUBLIC_* values in the client bundle. Keep secrets out of here.
export const CONVEX_URL =
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "https://convex.hookedcue.com";

export const CONVEX_SITE_URL =
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "https://cnx.hookedcue.com";

export const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL ?? "https://hookedcue.com";

export const WEB_APP_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://app.hookedcue.com";
