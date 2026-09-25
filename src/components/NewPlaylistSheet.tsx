import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, PLAYLIST_SWATCHES, withAlpha } from "../design/tokens";
import { MOODS, moodById, type MoodId } from "../data/mood";
import { nameAfterMoodPick } from "../lib/playlistMood";
import { Face } from "./faces";
import { Sheet, sheetText } from "./Sheet";

/**
 * FAB flow — pick a mood (or Any), name the playlist, pick its accent, and
 * start saving into it; the discovery rules fold away under "more options".
 * A mood fills in the name and colour and puts that lens on the deck.
 * Mirrors web's NewPlaylistSheet.
 */

export interface PlaylistRules {
  allowRepeats?: boolean;
  includeBuried?: boolean;
  includeBlockedArtists?: boolean;
}

const RULE_ROWS: {
  key: keyof PlaylistRules;
  label: string;
  sub: string;
}[] = [
  { key: "allowRepeats", label: "Allow songs to reappear", sub: "saved songs can come back around" },
  { key: "includeBuried", label: "Deal buried songs", sub: "songs you swiped left can return" },
  { key: "includeBlockedArtists", label: "Deal blocked artists", sub: "artists you blocked can return" },
];

export function NewPlaylistSheet({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, accent: string, rules?: PlaylistRules, mood?: MoodId | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const [accent, setAccent] = useState(PLAYLIST_SWATCHES[1]);
  const [rules, setRules] = useState<PlaylistRules>({});
  const [mood, setMood] = useState<MoodId | null>(null);
  const [more, setMore] = useState(false);
  // the name a mood filled in, which the next mood may replace
  const autoName = useRef("");
  const pickMood = (next: MoodId | null) => {
    setMood(next);
    const face = next ? moodById(next) : null;
    if (face) setAccent(face.accent);
    const after = nameAfterMoodPick(name, autoName.current, next);
    autoName.current = after.filled;
    setName(after.name);
  };
  const activeRules = Object.values(rules).filter(Boolean).length;
  const moodAccent = mood ? moodById(mood)?.accent : undefined;
  const swatches =
    moodAccent && !PLAYLIST_SWATCHES.includes(moodAccent)
      ? [moodAccent, ...PLAYLIST_SWATCHES]
      : PLAYLIST_SWATCHES;

  return (
    <Sheet onClose={onClose}>
      {(close) => {
        const create = () => {
          const trimmed = name.trim();
          if (!trimmed) return;
          onCreate(trimmed, accent, rules, mood);
          close();
        };
        return (
          <View>
            <Text style={sheetText.title}>New playlist</Text>
            <Text style={sheetText.sub}>
              {mood
                ? `Swipe down to save here. The deck leans ${moodById(mood)?.label.toLowerCase()} while you fill it.`
                : "Every song you swipe down is saved here until you pick another."}
            </Text>

            <Text style={styles.rulesLabel}>mood</Text>
            <View style={styles.moods} accessibilityRole="radiogroup">
              {[null, ...MOODS.map((m) => m.id)].map((id) => {
                const m = id ? moodById(id) : null;
                const on = mood === id;
                const tint = m ? m.accent : colors.text;
                return (
                  <Pressable
                    key={id ?? "any"}
                    style={styles.mood}
                    onPress={() => pickMood(id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={m ? `${m.label} — ${m.line}` : "Any mood"}
                  >
                    <View
                      style={[
                        styles.moodFace,
                        { borderColor: withAlpha(tint, 0.3) },
                        on && { backgroundColor: tint, borderColor: tint },
                      ]}
                    >
                      {id ? (
                        <Face mood={id} size={24} color={on ? colors.ink : tint} cut={on ? tint : colors.surface2} animated={on} />
                      ) : (
                        <Text style={[styles.any, on && { color: colors.ink }]}>∞</Text>
                      )}
                    </View>
                    <Text style={[styles.moodName, on && { color: colors.text }]} numberOfLines={1}>
                      {m ? m.label : "Any"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.rulesLabel}>name</Text>
            <TextInput
              // web .auth-input:focus — the field takes the accent while typing
              style={[styles.input, focused && { borderColor: withAlpha(accent, 0.7) }]}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
              placeholder="late night drives, gym, focus…"
              placeholderTextColor={colors.muted}
              value={name}
              maxLength={40}
              onChangeText={(t) => {
                autoName.current = "";
                setName(t);
              }}
              onSubmitEditing={create}
              returnKeyType="done"
            />
            <View style={styles.swatches}>
              {swatches.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    accent === c && styles.swatchOn,
                  ]}
                  onPress={() => setAccent(c)}
                />
              ))}
            </View>

            <Pressable
              style={styles.more}
              onPress={() => setMore((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: more }}
            >
              <Text style={styles.moreText}>{more ? "fewer options" : "more options"}</Text>
              {!more && activeRules > 0 && <Text style={styles.moreCount}>{activeRules} on</Text>}
              <Feather name={more ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
            </Pressable>
            {more && RULE_ROWS.map(({ key, label, sub }) => (
              <Pressable
                key={key}
                style={styles.ruleRow}
                onPress={() => setRules((r) => ({ ...r, [key]: !r[key] }))}
                accessibilityRole="switch"
                accessibilityState={{ selected: !!rules[key] }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.ruleLabel}>{label}</Text>
                  <Text style={styles.ruleSub}>{sub}</Text>
                </View>
                <View style={[styles.toggle, rules[key] && styles.toggleOn]}>
                  <View style={[styles.knob, rules[key] && styles.knobOn]} />
                </View>
              </Pressable>
            ))}

            <Pressable
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: accent },
                !name.trim() && { opacity: 0.4 },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              disabled={!name.trim()}
              onPress={create}
            >
              <Text style={styles.primaryText}>
                {mood ? "Create & start discovering" : "Create & start saving here"}
              </Text>
            </Pressable>
          </View>
        );
      }}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14.5,
  },
  swatches: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 16,
    marginHorizontal: 2,
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: "transparent",
  },
  swatchOn: {
    borderColor: colors.text,
    transform: [{ scale: 1.15 }],
  },
  moods: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  mood: { alignItems: "center", gap: 5, flex: 1 },
  moodFace: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  any: { fontSize: 17, color: colors.muted },
  moodName: { fontFamily: fonts.bodySemiBold, fontSize: 10.5, color: colors.muted },
  more: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, marginBottom: 6 },
  moreText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.muted },
  moreCount: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.text,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  rulesLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 8,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  ruleLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text },
  ruleSub: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  toggle: {
    width: 42,
    height: 25,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: colors.save, borderColor: colors.save },
  knob: {
    width: 19,
    height: 19,
    borderRadius: 999,
    marginLeft: 2,
    backgroundColor: "#FFFFFF",
  },
  knobOn: { transform: [{ translateX: 17 }] },
  primary: {
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: colors.ink,
  },
});
