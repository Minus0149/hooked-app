import { useState } from "react";
import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import type { Track } from "../types";
import { colors, fonts } from "../design/tokens";
import { Sheet, sheetText } from "./Sheet";
import { appleMusicUrl, ITUNES_CREDIT, needsItunesCredit } from "../lib/attribution";
import { REPORT_COPY } from "../lib/contentReport";
import { ReportSong } from "./ReportSong";
import { shareText, songShareUrl, songStoryUrl } from "../lib/growth";

import { useT } from "../lib/lang";
/** Links out to where the track can legally play in full — mirrors web. */
export function FullSongSheet({
  track,
  onClose,
  anonKey,
}: {
  track: Track;
  onClose: () => void;
  /** this install's anonymous key, so a guest's report is rate-limited too */
  anonKey?: string | null;
}) {
  const tt = useT();
  // "Report this song" turns this sheet into the report form (Play's UGC policy)
  const [reporting, setReporting] = useState(false);
  const q = encodeURIComponent(`${track.title} ${track.artist}`);
  // the song itself on Apple Music when the preview is Apple's (lib/attribution)
  const services = [
    { name: "Apple Music", url: appleMusicUrl(track) },
    { name: "Spotify", url: `https://open.spotify.com/search/${q}` },
    { name: "YouTube", url: `https://www.youtube.com/results?search_query=${q}` },
  ];

  return (
    <Sheet onClose={onClose}>
      {(close) =>
        reporting ? (
          <ReportSong track={track} anonKey={anonKey} onBack={() => setReporting(false)} onDone={close} />
        ) : (
        <View>
          {/* share a song at its hook — the Android share sheet, as on the web */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            onPress={() => {
              const url = songShareUrl(track.id);
              void Share.share({ message: `${shareText(track.title, track.artist)} ${url}`, url, title: track.title });
            }}
          >
            <Text style={[styles.note, { color: track.accent }]}>↗</Text>
            <Text style={styles.name}>{tt("Share this song")}</Text>
            <Text style={styles.shareSub}>{tt("opens at the hook")}</Text>
          </Pressable>
          <Pressable onPress={() => void Linking.openURL(songStoryUrl(track.id))} accessibilityRole="link">
            <Text style={styles.story}>{tt("story image for Instagram")}</Text>
          </Pressable>
          <Text style={sheetText.title}>{tt("Hear the whole thing")}</Text>
          <Text style={sheetText.sub}>
            "{track.title}" — {track.artist}. {tt("Previews stop at 30 seconds; pick where to keep listening.")}
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
            <Text style={styles.credit}>{tt(`preview ${ITUNES_CREDIT}`)}</Text>
          ) : null}
          <Pressable onPress={() => setReporting(true)} accessibilityRole="button">
            <Text style={styles.report}>{tt(REPORT_COPY.link)}</Text>
          </Pressable>
        </View>
        )
      }
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
  // web .sheet-share-sub / .sheet-share-story
  shareSub: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.muted },
  story: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: "underline",
    marginTop: -2,
    marginBottom: 14,
    marginLeft: 4,
  },
  // web .sheet-report
  report: {
    textAlign: "center",
    fontSize: 12.5,
    fontFamily: fonts.bodySemiBold,
    color: colors.muted,
    paddingVertical: 12,
    marginTop: 4,
  },
});
