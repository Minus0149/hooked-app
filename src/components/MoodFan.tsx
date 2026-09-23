import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { MOODS, type MoodId } from "../data/mood";
import type { Verdict } from "../data/predict";
import type { HapticsLevel } from "../data/prefs";
import { colors, fonts, mixHex, withAlpha } from "../design/tokens";
import { Sheet } from "./Sheet";
import { Face } from "./faces";

/**
 * The faces, on a long press — the mobile half of web/src/components/MoodFan.
 *
 * Built on the shared Sheet so it slides, dims and respects the safe area
 * exactly like the save-target and full-song sheets. Anchored to the bottom of
 * the screen rather than to the finger: a fan that blooms wherever the thumb
 * landed moves its targets every time, so nothing is ever learned, and near the
 * edge of a phone half of them fall off it.
 *
 * It asks about the SONG, not about the listener — "this one feels…" is a
 * question you can answer while looking at a card, and it is what makes the
 * crowd tags mean something. The deck still re-ranks toward the answer.
 */

export function MoodFan({
  title,
  picked,
  active,
  verdict,
  haptics = "subtle",
  onPick,
  onClear,
  onClose,
}: {
  title: string;
  picked: MoodId | null;
  active: MoodId | null;
  verdict: Verdict | null;
  haptics?: HapticsLevel;
  onPick: (mood: MoodId) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [focused, setFocused] = useState<MoodId>(picked ?? active ?? MOODS[0].id);
  const hint = MOODS.find((m) => m.id === focused) ?? MOODS[0];

  const tap = () => {
    if (haptics === "off") return;
    void Haptics.impactAsync(
      haptics === "full"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    );
  };

  return (
    <Sheet onClose={onClose}>
      {(close) => (
        <View>
          <Text style={styles.q} numberOfLines={1}>
            This one feels…
          </Text>
          {verdict?.worthShowing ? (
            <Text style={styles.verdict} numberOfLines={1}>
              <Text style={styles.pct}>{Math.round(verdict.chance * 100)}%</Text>
              {" your kind of thing"}
              {verdict.reasons.length > 0 ? ` · ${verdict.reasons.join(", ")}` : ""}
            </Text>
          ) : (
            <Text style={styles.verdict} numberOfLines={1}>
              {title}
            </Text>
          )}

          <View style={styles.arc}>
            {MOODS.map((mood, i) => {
              // a hump: the middle faces sit highest, the ends lowest
              const lift = Math.round(20 * Math.sin((Math.PI * (i + 0.5)) / MOODS.length));
              const isPicked = picked === mood.id;
              const isActive = active === mood.id;
              return (
                <Pressable
                  key={mood.id}
                  style={[
                    styles.face,
                    { marginBottom: lift },
                    isActive && { borderColor: mood.accent },
                    isPicked && {
                      backgroundColor: mood.accent,
                      borderColor: mood.accent,
                    },
                  ]}
                  onPressIn={() => setFocused(mood.id)}
                  onPress={() => {
                    tap();
                    setFocused(mood.id);
                    onPick(mood.id);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isPicked }}
                  accessibilityLabel={`${mood.label} — ${mood.line}`}
                >
                  <Face
                    mood={mood.id}
                    size={30}
                    color={isPicked ? colors.ink : mood.accent}
                  />
                  <Text
                    style={[
                      styles.faceLabel,
                      { color: isPicked ? colors.ink : colors.muted },
                    ]}
                    numberOfLines={1}
                  >
                    {mood.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.foot}>
            <Text style={styles.line} numberOfLines={1}>
              {hint.line}
            </Text>
            {active ? (
              <Pressable
                style={styles.clear}
                onPress={() => {
                  tap();
                  onClear();
                  close();
                }}
                accessibilityRole="button"
              >
                <Text style={styles.clearLabel}>Clear mood</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  q: {
    fontFamily: fonts.displayBold,
    fontSize: 14.5,
    color: colors.text,
    textAlign: "center",
  },
  verdict: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: 4,
  },
  pct: { fontFamily: fonts.bodyBold, color: colors.save },
  arc: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingTop: 22,
    paddingBottom: 6,
  },
  face: {
    flex: 1,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  faceLabel: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    gap: 12,
  },
  line: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  clear: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: mixHex(colors.surface2, colors.surface, 0.6),
  },
  clearLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: withAlpha(colors.text, 0.92),
  },
});
