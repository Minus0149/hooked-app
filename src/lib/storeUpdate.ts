/**
 * What to do about a newer build on Google Play.
 *
 * Over-the-air updates (expo-updates, UpdateBanner) cover JS; anything native
 * — a new permission, a new library, the splash — only arrives as a store
 * build. Play's in-app update API says whether one is available; this decides
 * how hard to push it:
 *
 *  - "force": the installed build is below the admin's minimum
 *    (runtime.minAndroidVersionCode) — Play's full-screen update, no way past;
 *  - "offer": a newer build exists — a banner the listener can tap or ignore;
 *  - "none": nothing to do.
 */
export type StoreUpdateAction = "none" | "offer" | "force";

export function storeUpdateAction(o: {
  available: boolean;
  installed: number | null;
  minVersionCode: number;
  immediateAllowed?: boolean;
  flexibleAllowed?: boolean;
}): StoreUpdateAction {
  if (!o.available) return "none";
  const belowMinimum = o.installed !== null && o.minVersionCode > 0 && o.installed < o.minVersionCode;
  if (belowMinimum && o.immediateAllowed !== false) return "force";
  if (o.flexibleAllowed === false && o.immediateAllowed === false) return "none";
  return "offer";
}

/** How long a dismissed offer stays dismissed, and how often to ask Play. */
export const OFFER_SNOOZE_MS = 24 * 60 * 60_000;
export const CHECK_EVERY_MS = 60 * 60_000;
