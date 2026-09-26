import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { Track } from "../types";
import { colors, fonts } from "../design/tokens";
import { Sheet, sheetText } from "./Sheet";
import { appleMusicUrl, ITUNES_CREDIT, needsItunesCredit } from "../lib/attribution";

/** Links out to where the track can legally play in full — mirrors web. */
export function FullSongSheet({
  track,
  onClose,
}: {
  track: Track;
  onClose: () => void;
}) {
  const q = encodeURIComponent(`${track.title} ${track.artist}`);
  // the song itself on Apple Music when the preview is Apple's (lib/attribution)
  const services = [
    { name: "Apple Music", url: appleMusicUrl(track) },
    { name: "Spotify", url: `https://open.spotify.com/search/${q}` },
    { name: "YouTube", url: `https://www.youtube.com/results?search_query=${q}` },
  ];

  return (
    <Sheet onClose={onClose}>
      {(close) => (
        <View>
          <Text style={sheetText.title}>Hear the whole thing</Text>
          <Text style={sheetText.sub}>
            "{track.title}" — {track.artist}. Previews stop at 30 seconds; pick
            where to keep listening.
          </Text>
          {services.map((s) => (
            <Pressable
              key={s.name}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
              onPress={() => {
                void Linking.openURL(s.url);
                close();
              }}
            >
              <Text style={[styles.note, { color: track.accent }]}>♪</Text>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={[styles.arrow, { color: track.accent }]}>↗</Text>
            </Pressable>
          ))}
          {needsItunesCredit(track) ? (
            <Text style={styles.credit}>preview {ITUNES_CREDIT}</Text>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // web .sheet-credit
  credit: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 11.5,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  row: {
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
  note: { fontSize: 16, width: 20, textAlign: "center" },
  name: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    color: colors.text,
  },
  arrow: { fontSize: 15 },
});
