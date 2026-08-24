import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Updates from "expo-updates";
import { colors, fonts } from "../design/tokens";

/**
 * Over-the-air update banner.
 *
 * expo-updates checks on launch (config) and we re-check when the app returns
 * to the foreground. When a bundle has downloaded, this slides in and offers
 * the restart — the new UI is live the moment they tap it. Nothing interrupts
 * playback or navigation by itself; restarting is always the user's tap.
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (__DEV__) return;
    const check = () => {
      void Updates.checkForUpdateAsync()
        .then((res) => {
          if (res.isAvailable) return Updates.fetchUpdateAsync();
          return null;
        })
        .then((res) => {
          if (res?.isNew) setReady(true);
        })
        .catch(() => undefined); // offline is normal, not an error worth surfacing
    };
    check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, []);

  const apply = useCallback(() => {
    void Updates.reloadAsync().catch(() => undefined);
  }, []);

  if (__DEV__ || !ready) return null;

  return (
    <Animated.View entering={FadeInDown.springify().stiffness(380).damping(28)} style={styles.wrap} pointerEvents="box-none">
      <Pressable style={styles.bar} onPress={apply} accessibilityRole="button" accessibilityLabel="restart to apply update">
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
  text: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
  cta: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.accentDefault },
});
