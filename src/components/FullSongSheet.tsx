import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { Track } from "../types";
import { colors, fonts } from "../design/tokens";
import { Sheet, sheetText } from "./Sheet";

/** Links out to where the track can legally play in full — mirrors web. */
export function FullSongSheet({
  track,
  onClose,
}: {
  track: Track;
  onClose: () => void;
}) {
  const q = encodeURIComponent(`${track.title} ${track.artist}`);
  const services = [
    { name: "Apple Music", url: `https://music.apple.com/us/song/${track.id}` },
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
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
