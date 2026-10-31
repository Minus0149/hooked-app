import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { Reveal } from "../lib/crowdReveal";
import type { MotionLevel } from "../data/prefs";
import { colors, fonts } from "../design/tokens";

const EASE = Easing.bezier(0.2, 0, 0, 1);

/**
 * Shown for a moment after a save or skip: how everyone else judged the song
 * you just swiped, and your run of calls that matched the crowd. The phone's
 * web/src/components/CrowdReveal.tsx; the rules are lib/crowdReveal.ts.
 *
 * Motion follows the in-app setting, never the OS flag (ReduceMotion.Never):
 * "full" slides in and grows the bar, "reduced" only fades, "off" just appears.
 */
export function CrowdReveal({
  reveal,
  title,
  streak,
  motion,
}: {
  reveal: Reveal;
  title: string;
  streak: number;
  motion: MotionLevel;
}) {
  const you = reveal.mine === "save" ? "You saved it" : "You skipped it";
  const entering =
    motion === "full"
      ? FadeInUp.duration(220).easing(EASE).reduceMotion(ReduceMotion.Never)
      : motion === "reduced"
        ? FadeIn.duration(160).reduceMotion(ReduceMotion.Never)
        : undefined;
  const exiting =
    motion === "full"
      ? FadeOutUp.duration(220).easing(EASE).reduceMotion(ReduceMotion.Never)
      : motion === "reduced"
        ? FadeOut.duration(160).reduceMotion(ReduceMotion.Never)
        : undefined;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        entering={entering}
        exiting={exiting}
        style={styles.card}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.song} numberOfLines={1}>
          {title}
        </Text>
        {reveal.kind === "first" ? (
          <Text style={styles.line}>
            <Text style={styles.strong}>{you}.</Text> You're one of the first to judge this one.
          </Text>
        ) : (
          <>
            <SplitBar savePct={reveal.savePct} animate={motion === "full"} />
            <View style={styles.nums}>
              <Text style={[styles.num, reveal.mine === "save" && styles.mineSave]}>
                {reveal.savePct}% saved
              </Text>
              <Text style={[styles.num, reveal.mine === "skip" && styles.mineSkip]}>
                {reveal.skipPct}% skipped
              </Text>
            </View>
            <Text style={styles.line}>
              <Text style={styles.strong}>{you}</Text>{" "}
              {reveal.withCrowd ? "— with the crowd" : "— against the crowd"}
              {streak >= 2 ? <Text style={styles.streak}> · {streak} in a row</Text> : null}
            </Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

/** The save share of the split, growing from an even 50% as on the web. */
function SplitBar({ savePct, animate }: { savePct: number; animate: boolean }) {
  const width = useSharedValue(animate ? 50 : savePct);
  useEffect(() => {
    width.value = animate
      ? withTiming(savePct, { duration: 500, easing: EASE, reduceMotion: ReduceMotion.Never })
      : savePct;
  }, [savePct, animate, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barSave, fill]} />
    </View>
  );
}

// web .crowd: a dark glass card under the top bar, centred, at most 340 wide
const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 64,
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 31,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(19,19,27,0.96)",
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  song: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 8,
  },
  bar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(142,140,153,0.35)",
    overflow: "hidden",
  },
  barSave: { height: "100%", borderRadius: 999, backgroundColor: colors.save },
  nums: { flexDirection: "row", justifyContent: "space-between", marginVertical: 6 },
  num: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.muted },
  mineSave: { fontFamily: fonts.bodyBold, color: colors.save },
  mineSkip: { fontFamily: fonts.bodyBold, color: colors.text },
  line: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.text },
  strong: { fontFamily: fonts.bodyBold },
  streak: { fontFamily: fonts.bodyBold, color: colors.more },
});
