import { createAuthClient } from "better-auth/react";
import type { BetterAuthClientPlugin } from "better-auth";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { CONVEX_SITE_URL } from "../config/env";

export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL,
  plugins: [
    convexClient(),
    // cast: minor type-level skew between better-auth 1.6.x and the Expo
    // plugin's bundled declarations; runtime shape is identical (web's
    // auth-client casts its crossDomainClient for the same reason)
    expoClient({
      scheme: "hooked",
      storagePrefix: "hooked",
      storage: SecureStore,
    }) as unknown as BetterAuthClientPlugin,
  ],
});
