import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { CONVEX_SITE_URL } from "../config/env";

export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL,
  plugins: [
    convexClient(),
    // no cast: with better-auth and its plugins on matching versions the
    // types line up, and the old `as unknown as` erased the session's type to
    // `never` once they moved (same fix as web's auth-client)
    expoClient({
      scheme: "hooked",
      storagePrefix: "hooked",
      storage: SecureStore,
    }),
  ],
});
