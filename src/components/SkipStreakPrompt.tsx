import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  ReduceMotion,
} from "react-native-reanimated";
import { MOODS, type MoodId } from "../data/mood";
import type { MotionLevel } from "../data/prefs";
import { colors, fonts, radii, withAlpha } from "../design/tokens";

const EASE = Easing.bezier(0.2, 0, 0, 1);

/**
 * Shown over the deck after a long run of skips (lib/skipStreak.ts): pick a
 * mood to switch the deck, start the suggestions fresh, or keep going. The
 * phone's web/src/components/SkipStreakPrompt.tsx.
 *
 * Motion follows the in-app setting, never the OS flag (ReduceMotion.Never).
 */
export function SkipStreakPrompt({
  streak,
  accent,
  motion,
  onMood,
  onFresh,
  onDismiss,
}: {
  streak: number;
  /** the app's accent right now (web's var(--accent)) */
  accent: string;
  motion: MotionLevel;
  onMood: (mood: MoodId) => void;
  onFresh: () => void;
  onDismiss: () => void;
}) {
  const entering =
    motion === "full"
      ? FadeInDown.duration(280).easing(EASE).reduceMotion(ReduceMotion.Never)
      : motion === "reduced"
        ? FadeIn.duration(180).reduceMotion(ReduceMotion.Never)
        : undefined;
  const exiting =
    motion === "full"
      ? FadeOutDown.duration(220).easing(EASE).reduceMotion(ReduceMotion.Never)
      : motion === "reduced"
        ? FadeOut.duration(160).reduceMotion(ReduceMotion.Never)
        : undefined;

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      style={styles.card}
      accessibilityLabel="Not feeling these songs?"
    >
      <Text style={styles.title}>Not feeling these?</Text>
      <Text style={styles.sub}>
        {streak} skips in a row. Pick a mood, or start the suggestions fresh.
      </Text>
      <View style={styles.moods}>
        {MOODS.map((m) => (
          <Pressable
            key={m.id}
            style={({ pressed }) => [
              styles.mood,
              { borderColor: m.accent },
              pressed && { backgroundColor: withAlpha(m.accent, 0.16) },
            ]}
            onPress={() => onMood(m.id)}
            accessibilityRole="button"
            accessibilityLabel={`${m.label} mood`}
          >
            <Text style={[styles.moodText, { color: m.accent }]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.action, { backgroundColor: accent }, pressed && styles.pressed]}
          onPress={onFresh}
          accessibilityRole="button"
        >
          <Text style={[styles.actionText, { color: colors.ink }]}>Fresh suggestions</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.action, styles.dismiss, pressed && styles.pressed]}
          onPress={onDismiss}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>Keep going</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// web .skip-prompt: a card above the bottom nav, at most 440 wide
const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 96,
    alignSelf: "center",
    maxWidth: 440,
    zIndex: 40,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#111118",
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  title: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text, marginBottom: 4 },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, marginBottom: 12 },
  moods: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  mood: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  moodText: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  actions: { flexDirection: "row", gap: 8 },
  action: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
  },
  dismiss: { borderWidth: 1, borderColor: colors.line },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  pressed: { transform: [{ scale: 0.97 }] },
});
