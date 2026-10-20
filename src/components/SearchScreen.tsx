import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../state/store";
import type { Track } from "../types";
import { colors, fonts, radii } from "../design/tokens";
import { art } from "../lib/art";
import { searchSongs } from "../lib/songSearch";
import { useT } from "../lib/lang";

/**
 * Find a song in the deck by title, artist or album. The catalogue is already
 * on the phone, so results come with every keystroke and nothing is fetched
 * (src/lib/songSearch.ts, mirrored from web). Tapping a result plays it from
 * its hook. Same behaviour as web/src/components/SearchScreen.tsx.
 */
export function SearchScreen({
  accent,
  onBack,
  onPlay,
}: {
  accent: string;
  onBack: () => void;
  onPlay: (track: Track) => void;
}) {
  const tt = useT();
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSongs(state.catalog, query, 60), [state.catalog, query]);
  const typed = query.trim().length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel={tt("Back to home")} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.inputWrap}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            placeholder={tt("Songs, artists or albums")}
            placeholderTextColor={colors.muted}
            selectionColor={accent}
            accessibilityLabel={tt("Search songs")}
            onSubmitEditing={() => results[0] && onPlay(results[0])}
          />
          {typed && (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={tt("Cancel")}>
              <Feather name="x" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {!typed && (
        <Text style={styles.hint}>
          {tt("Search all {n} songs in the deck. Tap one to play it from its hook.", { n: state.catalog.length.toLocaleString() })}
        </Text>
      )}
      {typed && results.length === 0 && (
        <Text style={styles.hint}>{tt("Nothing in the deck matches “{q}” yet.", { q: query.trim() })}</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(t) => t.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        renderItem={({ item: t }) => (
          <Pressable
            onPress={() => onPlay(t)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel={`${t.title} — ${t.artist}. ${tt("Play it")}.`}
          >
            <Image source={{ uri: art(t.artwork, 120) }} style={styles.art} />
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={1}>{t.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>{t.artist}</Text>
            </View>
            <Text style={styles.genre} numberOfLines={1}>{t.genre}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 0 },
  hint: { color: colors.muted, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, paddingHorizontal: 22, paddingVertical: 18 },
  list: { paddingHorizontal: 10, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 14 },
  art: { width: 46, height: 46, borderRadius: 10, backgroundColor: colors.surface },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.text },
  artist: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  genre: {
    maxWidth: "30%",
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
  },
});
