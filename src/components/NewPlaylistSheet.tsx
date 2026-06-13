import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, PLAYLIST_SWATCHES } from "../design/tokens";
import { Sheet, sheetText } from "./Sheet";

/**
 * FAB flow — name a playlist, pick its accent, and start saving into it.
 * Mirrors web's NewPlaylistSheet.
 */
export function NewPlaylistSheet({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, accent: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [accent, setAccent] = useState(PLAYLIST_SWATCHES[1]);

  return (
    <Sheet onClose={onClose}>
      {(close) => {
        const create = () => {
          const trimmed = name.trim();
          if (!trimmed) return;
          onCreate(trimmed, accent);
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
  primary: {
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },
  primaryText: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: colors.ink,
  },
});
