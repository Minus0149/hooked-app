import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, PLAYLIST_SWATCHES } from "../design/tokens";
import { Sheet, sheetText } from "./Sheet";

/**
 * FAB flow — name a playlist, pick its accent, set its discovery rules, and
 * start saving into it. Mirrors web's NewPlaylistSheet.
 */

interface PlaylistRules {
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
  onCreate: (name: string, accent: string, rules?: PlaylistRules) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [accent, setAccent] = useState(PLAYLIST_SWATCHES[1]);
  const [rules, setRules] = useState<PlaylistRules>({});

  return (
    <Sheet onClose={onClose}>
      {(close) => {
        const create = () => {
          const trimmed = name.trim();
          if (!trimmed) return;
          onCreate(trimmed, accent, rules);
          close();
        };
        return (
          <View>
            <Text style={sheetText.title}>New playlist</Text>
            <Text style={sheetText.sub}>
              Every song you swipe down will be saved here until you change it in
              settings.
            </Text>
            <TextInput
              style={styles.input}
              autoFocus
              placeholder="late night drives, gym, focus…"
              placeholderTextColor={colors.muted}
              value={name}
              maxLength={40}
              onChangeText={setName}
              onSubmitEditing={create}
              returnKeyType="done"
            />
            <View style={styles.swatches}>
              {PLAYLIST_SWATCHES.map((c) => (
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

            <Text style={styles.rulesLabel}>discovery rules</Text>
            {RULE_ROWS.map(({ key, label, sub }) => (
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
              <Text style={styles.primaryText}>Create &amp; start saving here</Text>
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
