import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const HEIGHTS = [0.6, 1, 0.45, 0.8]; // matches web .eq span heights

function Bar({
  color,
  playing,
  height,
  delay,
}: {
  color: string;
  playing: boolean;
  height: number;
  delay: number;
}) {
  const v = useSharedValue(0.4);

  useEffect(() => {
    if (playing) {
      v.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 450 }),
            withTiming(0.4, { duration: 450 }),
          ),
          -1,
        ),
      );
    } else {
      cancelAnimation(v);
      v.value = withTiming(0.35, { duration: 180 });
    }
    return () => cancelAnimation(v);
  }, [playing, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: v.value }],
  }));

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: color, height: 14 * height }, style]}
    />
  );
}

// Tiny 4-bar equalizer (web .eq) — pulses while playing, slumps when paused.
export function Eq({ color, playing }: { color: string; playing: boolean }) {
  return (
    <View style={styles.eq}>
      {HEIGHTS.map((h, i) => (
        <Bar key={i} color={color} playing={playing} height={h} delay={i * 180} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  eq: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2.5,
    height: 14,
  },
  bar: { width: 3, borderRadius: 2 },
});
