import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../design/tokens";
import { art } from "../lib/art";
import { useStore } from "../state/store";

/**
 * Which of your own lists are allowed back into the deck.
 *
 * The first version was a stack of identical toggle rows reading "Liked Songs —
 * 12 songs · kept out of the deck". Correct, and unreadable: every playlist
 * looked the same, so the one decision that actually differs per list — is this
 * an archive or a rotation? — was the hardest thing to see.
 *
 * Each list now carries its own accent, the artwork already in it, and its
 * state in words beside the switch, because a lone switch never says which way
 * is which. Matches the web build so the two can't drift apart.
 */

type Entry = {
  id: string;
  name: string;
  tracks: { id: string; artwork: string }[];
  accent: string;
};

function Cover({ tracks, accent }: { tracks: Entry["tracks"]; accent: string }) {
  const shown = tracks.slice(0, 4);
  if (shown.length === 0) {
    return <View style={[styles.cover, styles.coverEmpty, { borderColor: accent + "55" }]} />;
  }
  if (shown.length < 4) {
    return (
      <View style={styles.cover}>
        <Image source={{ uri: art(shown[0].artwork, 100) }} style={styles.coverFull} />
      </View>
    );
  }
  return (
    <View style={[styles.cover, styles.coverQuad]}>
      {shown.map((t) => (
        <Image key={t.id} source={{ uri: art(t.artwork, 100) }} style={styles.coverCell} />
      ))}
    </View>
  );
}

function Switch({ on, accent }: { on: boolean; accent: string }) {
  return (
    <View style={[styles.track, on && { backgroundColor: accent }]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

export function ReplayRules({
  onReplay,
  onUnbury,
}: {
  onReplay: (container: string, allow: boolean) => void;
  onUnbury: (trackId: string) => void;
}) {
  const { state } = useStore();
  const [showBuried, setShowBuried] = useState(false);

  const entries: Entry[] = [
    { id: "liked", name: "Liked Songs", tracks: state.liked, accent: colors.save },
    { id: "discoveries", name: "Discoveries", tracks: state.discoveries, accent: colors.more },
    ...state.playlists.map((p) => ({
      id: `pl:${p.id}`,
      name: p.name,
      tracks: p.tracks,
      accent: p.accent,
    })),
  ];

  return (
    <>
      <Text style={styles.group}>what comes back</Text>
      <Text style={styles.note}>
        Saving a song normally takes it out of the deck — you already have it.
        Switch a list back on if you treat it as a rotation rather than an
        archive. Songs you swiped left on stay gone either way.
      </Text>

      {entries.map((e) => {
        const on = state.replayContainers.includes(e.id);
        return (
          <Pressable
            key={e.id}
            style={[styles.item, on && { borderColor: e.accent + "88", backgroundColor: e.accent + "14" }]}
            onPress={() => onReplay(e.id, !on)}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${e.name}, ${on ? "comes back" : "kept out of the deck"}`}
          >
            <Cover tracks={e.tracks} accent={e.accent} />
            <View style={styles.meta}>
              <Text style={styles.name} numberOfLines={1}>
                {e.name}
              </Text>
              <Text style={styles.count}>
                {e.tracks.length === 0
                  ? "nothing saved here yet"
                  : `${e.tracks.length} song${e.tracks.length === 1 ? "" : "s"}`}
              </Text>
            </View>
            <View style={styles.state}>
              <Text style={[styles.stateWord, on && { color: e.accent }]}>
                {on ? "comes back" : "kept out"}
              </Text>
              <Switch on={on} accent={e.accent} />
            </View>
          </Pressable>
        );
      })}

      {state.neverTracks.length > 0 && (
        <>
          <Pressable
            style={styles.buriedHead}
            onPress={() => setShowBuried((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${state.neverTracks.length} buried songs, ${showBuried ? "hide" : "show"}`}
          >
            <Feather name="x" size={17} color={colors.never} />
            <View style={styles.meta}>
              <Text style={styles.name}>
                {state.neverTracks.length} buried song
                {state.neverTracks.length === 1 ? "" : "s"}
              </Text>
              <Text style={styles.count}>swiped left — these never come back on their own</Text>
            </View>
            <Text style={styles.stateWord}>{showBuried ? "hide" : "show"}</Text>
          </Pressable>
          {showBuried &&
            state.neverTracks.slice(0, 50).map((id) => {
              const t = state.catalog.find((c) => c.id === id);
              return (
                <Pressable
                  key={id}
                  style={styles.buriedRow}
                  onPress={() => onUnbury(id)}
                  accessibilityRole="button"
                  accessibilityLabel={`dig out ${t?.title ?? "this song"}`}
                >
                  <View style={styles.meta}>
                    <Text style={styles.name} numberOfLines={1}>
                      {t?.title ?? "a song no longer in the catalogue"}
                    </Text>
                    <Text style={styles.count}>{t?.artist ?? id}</Text>
                  </View>
                  <Text style={styles.stateWord}>dig out</Text>
                </Pressable>
              );
            })}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.muted,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 8,
  },
  note: {
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.muted,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 10,
    borderRadius: 16, // matches .rr-item on web; radii.card (28) is far too round for a row
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  cover: { width: 48, height: 48, borderRadius: 11, overflow: "hidden" },
  coverEmpty: { borderWidth: 1, borderStyle: "dashed" },
  coverFull: { width: "100%", height: "100%" },
  coverQuad: { flexDirection: "row", flexWrap: "wrap" },
  coverCell: { width: "50%", height: "50%" },
  meta: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: colors.text, fontSize: 14, fontWeight: "600" },
  count: { color: colors.muted, fontSize: 11.5 },
  state: { flexDirection: "row", alignItems: "center", gap: 9 },
  stateWord: { color: colors.muted, fontSize: 11 },
  track: {
    width: 42,
    height: 25,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    padding: 3,
  },
  knob: { width: 19, height: 19, borderRadius: 999, backgroundColor: "#fff" },
  knobOn: { alignSelf: "flex-end" },
  buriedHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginHorizontal: 14,
    marginTop: 6,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buriedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginHorizontal: 22,
    paddingVertical: 10,
  },
});
