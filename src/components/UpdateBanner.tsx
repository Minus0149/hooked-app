import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Updates from "expo-updates";
import * as Application from "expo-application";
import * as InAppUpdates from "expo-in-app-updates";
import { colors, fonts } from "../design/tokens";
import { CHECK_EVERY_MS, OFFER_SNOOZE_MS, storeUpdateAction } from "../lib/storeUpdate";

/**
 * Both kinds of update, in one place.
 *
 * Over the air (expo-updates): checked on launch (config) and whenever the app
 * returns to the foreground; a downloaded bundle applies itself on the next
 * cold start, and this offers the restart sooner. Restarting is always the
 * listener's tap — nothing interrupts playback by itself.
 *
 * Google Play (Android): a newer store build — the only way native changes
 * arrive — is offered as a banner that starts Play's in-app update (it
 * downloads in the background, then installs and reopens the app). A build
 * below the admin's minimum (runtime.minAndroidVersionCode) gets Play's
 * full-screen update instead; see src/lib/storeUpdate.ts.
 */
export function UpdateBanner({ minVersionCode = 0 }: { minVersionCode?: number }) {
  const [otaReady, setOtaReady] = useState(false);
  const [storeOffer, setStoreOffer] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const lastStoreCheck = useRef(0);
  const snoozedUntil = useRef(0);
  const minRef = useRef(minVersionCode);
  minRef.current = minVersionCode;

  const checkStore = useCallback(async (force = false) => {
    if (Platform.OS !== "android") return;
    const now = Date.now();
    if (!force && now - lastStoreCheck.current < CHECK_EVERY_MS) return;
    lastStoreCheck.current = now;
    try {
      const info = await InAppUpdates.checkForUpdate();
      const installed = Number(Application.nativeBuildVersion);
      const action = storeUpdateAction({
        available: info.updateAvailable,
        installed: Number.isFinite(installed) ? installed : null,
        minVersionCode: minRef.current,
        immediateAllowed: info.immediateAllowed,
        flexibleAllowed: info.flexibleAllowed,
      });
      if (action === "force") {
        await InAppUpdates.startUpdate(true);
      } else {
        setStoreOffer(action === "offer" && Date.now() > snoozedUntil.current);
      }
    } catch {
      // not installed from Play (a sideload, the emulator) or offline: nothing to offer
    }
  }, []);

  useEffect(() => {
    if (__DEV__) return;
    const checkOta = () => {
      void Updates.checkForUpdateAsync()
        .then((res) => {
          if (res.isAvailable) return Updates.fetchUpdateAsync();
          return null;
        })
        .then((res) => {
          if (res?.isNew) setOtaReady(true);
        })
        .catch(() => undefined); // offline is normal, not an error worth surfacing
    };
    checkOta();
    void checkStore(true);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        checkOta();
        void checkStore();
      }
    });
    const removeCancelled = InAppUpdates.addUpdateListener("updateCancelled", () => setDownloading(false));
    return () => {
      sub.remove();
      removeCancelled();
    };
  }, [checkStore]);

  // an admin raising the minimum reaches phones already open
  useEffect(() => {
    if (!__DEV__ && minVersionCode > 0) void checkStore(true);
  }, [minVersionCode, checkStore]);

  const applyOta = useCallback(() => {
    void Updates.reloadAsync().catch(() => undefined);
  }, []);

  const startStore = useCallback(() => {
    setDownloading(true);
    void InAppUpdates.startUpdate(false)
      .then((started) => {
        if (!started) setDownloading(false);
      })
      .catch(() => setDownloading(false));
  }, []);

  const later = useCallback(() => {
    snoozedUntil.current = Date.now() + OFFER_SNOOZE_MS;
    setStoreOffer(false);
  }, []);

  if (__DEV__) return null;

  if (storeOffer) {
    return (
      <Animated.View entering={FadeInDown.springify().stiffness(380).damping(28)} style={styles.wrap} pointerEvents="box-none">
        <View style={styles.bar}>
          <Pressable onPress={startStore} disabled={downloading} accessibilityRole="button" accessibilityLabel="update from Google Play" style={styles.main}>
            <Text style={styles.text}>{downloading ? "Downloading the update" : "A new version is out"}</Text>
            {!downloading && <Text style={styles.cta}>update</Text>}
          </Pressable>
          {!downloading && (
            <Pressable onPress={later} accessibilityRole="button" accessibilityLabel="remind me later" hitSlop={10}>
              <Text style={styles.later}>later</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  }

  if (!otaReady) return null;

  return (
    <Animated.View entering={FadeInDown.springify().stiffness(380).damping(28)} style={styles.wrap} pointerEvents="box-none">
      <Pressable style={styles.bar} onPress={applyOta} accessibilityRole="button" accessibilityLabel="restart to apply update">
        <Text style={styles.text}>A fresh version is ready</Text>
        <Text style={styles.cta}>tap to restart</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 96, alignItems: "center" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  main: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
  cta: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.accentDefault },
  later: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.muted, marginLeft: 6 },
});
