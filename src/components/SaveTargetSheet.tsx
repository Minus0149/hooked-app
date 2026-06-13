import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Playlist, SaveTarget } from "../types";
import { colors, fonts, PLAYLIST_SWATCHES } from "../design/tokens";
import { Sheet, sheetText } from "./Sheet";

function Option({
  icon,
  iconColor,
  label,
  on,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.option,
        on && styles.optionOn,
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
    >
      <View style={styles.optionGlyph}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.optionLabel} numberOfLines={1}>
        {label}
      </Text>
      <Feather
        name="check"
        size={15}
        color={colors.accentDefault}
        style={{ opacity: on ? 1 : 0 }}
      />
    </Pressable>
  );
}

/** Where a ↓ swipe sends the song — mirrors web's SaveTargetSheet. */
export function SaveTargetSheet({
  value,
  playlists,
  accent,
  onChange,
  onCreatePlaylist,
  onClose,
}: {
  value: SaveTarget;
  playlists: Playlist[];
  accent: string;
  onChange: (t: SaveTarget) => void;
  onCreatePlaylist: (name: string, accent: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const swatch = PLAYLIST_SWATCHES[playlists.length % PLAYLIST_SWATCHES.length];
    onCreatePlaylist(trimmed, swatch);
    setName("");
  };

  return (
    <Sheet onClose={onClose}>
      {(close) => {
        const pick = (t: SaveTarget) => {
          onChange(t);
          close();
        };
        return (
          <View>
            <Text style={sheetText.title}>Swipe down saves to…</Text>
            <Text style={sheetText.sub}>Pick where a ↓ swipe sends the song.</Text>

            <ScrollView style={styles.options} bounces={false}>
              <Option
                icon="heart"
                iconColor={colors.save}
                label="Liked Songs"
                on={value === "liked"}
                onPress={() => pick("liked")}
              />
              <Option
                icon="folder"
                iconColor={colors.more}
                label="Discoveries playlist"
                on={value === "discoveries"}
                onPress={() => pick("discoveries")}
              />
              {playlists.map((p) => (
                <Option
                  key={p.id}
                  icon="folder"
                  iconColor={p.accent}
                  label={p.name}
                  on={value === `pl:${p.id}`}
                  onPress={() => pick(`pl:${p.id}`)}
                />
              ))}
            </ScrollView>

            <View style={styles.createRow}>
              <TextInput
                style={styles.input}
                placeholder="new playlist name…"
                placeholderTextColor={colors.muted}
                value={name}
                maxLength={40}
                onChangeText={setName}
                onSubmitEditing={create}
                returnKeyType="done"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.createBtn,
                  { backgroundColor: accent },
                  !name.trim() && { opacity: 0.4 },
                  pressed && { opacity: 0.8 },
                ]}
                disabled={!name.trim()}
                onPress={create}
              >
                <Text style={styles.createBtnText}>create</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  options: { maxHeight: 300, marginBottom: 4 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    marginBottom: 10,
  },
  optionOn: { borderColor: colors.accentDefault },
  optionGlyph: { width: 20, alignItems: "center" },
  optionLabel: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    color: colors.text,
  },
  check: { color: colors.accentDefault, fontSize: 15 },
  createRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  createBtn: {
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.ink,
  },
});
