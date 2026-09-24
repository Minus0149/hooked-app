import { useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../state/store";
import type { LibraryContainer, Track } from "../types";
import { colors, fonts, mixHex, radii } from "../design/tokens";
import { art } from "../lib/art";
import { Eq } from "./Eq";
import { Face } from "./faces";
import { inkOn } from "../lib/contrast";
import { DAYPART_COPY, DAYPART_MOOD, daypartAt, moodsForHour } from "../data/mood";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "up late";
  if (h < 12) return "good morning";
  if (h < 18) return "good afternoon";
  return "good evening";
}

// Two-cell artwork mosaic for a library tile; a single quiet heart when empty
function Mosaic({ tracks }: { tracks: Track[] }) {
  const cells = tracks.slice(0, 2);
  if (cells.length === 0) {
    return (
      <View style={styles.mosaic}>
        <View style={[styles.mosaicEmpty, { flex: 1 }]}>
          <Feather name="heart" size={15} color="#3C3C48" />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.mosaic}>
      {cells.map((t) => (
        <Image key={t.id} source={{ uri: art(t.artwork, 200) }} style={styles.mosaicArt} />
      ))}
      {cells.length === 1 && (
        <View style={styles.mosaicEmpty}>
          <Feather name="heart" size={15} color="#3C3C48" />
        </View>
      )}
    </View>
  );
}

function RowCard({ track, onPick }: { track: Track; onPick: (id: string) => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}
      onPress={() => onPick(track.id)}
    >
      <Image source={{ uri: art(track.artwork, 300) }} style={styles.rowArt} />
      <Text style={styles.rowTitle} numberOfLines={1}>
        {track.title}
      </Text>
      <Text style={styles.rowArtist} numberOfLines={1}>
        {track.artist}
      </Text>
    </Pressable>
  );
}

export function HomeScreen({
  accent,
  onDiscover,
  onOpenLibrary,
  onNewPlaylist,
}: {
  accent: string;
  onDiscover: (trackId?: string) => void;
  onOpenLibrary: (container: LibraryContainer) => void;
  onNewPlaylist: () => void;
}) {
  const { state, setMood } = useStore();
  const { liked, discoveries, playlists, queue, boostGenres, catalog } = state;

  /**
   * The faces, out in the open.
   *
   * The long press on a card is the fast way in and an invisible one. This row
   * is where the feature is actually discovered, and it answers the question
   * somebody on the home screen is already asking — not "what does this song
   * feel like" but "what do I want". Ordered by the hour, never filtered by it:
   * the clock is a guess about a person, and it is wrong for anyone on nights.
   */
  const hour = useMemo(() => {
    const part = daypartAt();
    return { part, moods: moodsForHour(), suggested: DAYPART_MOOD[part] };
  }, []);

  const fresh = useMemo(() => queue.slice(0, 10), [queue]);

  // parity with web: the right-swipe steer surfaces as its own row, deduped
  // by normalized title+artist and never repeating what the queue already
  // shows below it
  const becauseRows = useMemo(() => {
    const norm = (t: Track) =>
      `${t.title}·${t.artist}`.toLowerCase().replace(/\(.*?\)/g, "").trim();
    const queueIds = new Set(queue.map((t) => t.id));
    const genres =
      boostGenres.length > 0
        ? boostGenres
        : [...new Set(liked.map((t) => t.genre))].slice(0, 2);
    return genres
      .map((genre) => {
        const seen = new Set<string>();
        const tracks = catalog
          .filter(
            (t) =>
              t.genre === genre &&
              !liked.some((l) => l.id === t.id) &&
              !queueIds.has(t.id),
          )
          .filter((t) => {
            const key = norm(t);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 8);
        return { genre, tracks };
      })
      .filter((r) => r.tracks.length > 0);
  }, [boostGenres, liked, catalog, queue]);


  // All seven choices fit in one row. It used to scroll sideways, which hid
  // the mood you were in half the time and cut a face in half at the edge.
  // dark or white text, whichever reads on this accent
  const onAccent = inkOn(accent);
  const libraryEmpty = liked.length === 0 && discoveries.length === 0 && playlists.length === 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.greeting}>{greeting()}</Text>
      <Text style={styles.title}>
        what's your next <Text style={{ color: accent }}>obsession?</Text>
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: accent },
          pressed && styles.pressed,
        ]}
        onPress={() => onDiscover()}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.ctaLabel, { color: onAccent }]}>Start discovering</Text>
          <Text style={[styles.ctaSub, { color: onAccent }]}>{queue.length} songs queued for you</Text>
        </View>
        <Eq color={onAccent} playing />
      </Pressable>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>What&apos;s the mood?</Text>
      </View>
      <View style={styles.moodRow}>
        {hour.moods.map((mood) => {
          const isOn = state.mood === mood.id;
          const isSuggested =
            state.prefs.moodByTime !== "off" && mood.id === hour.suggested;
          return (
            <Pressable
              key={mood.id}
              style={({ pressed }) => [
                styles.moodChip,
                pressed && { transform: [{ scale: 0.94 }] },
              ]}
              onPress={() => {
                setMood(mood.id);
                onDiscover();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isOn }}
              accessibilityLabel={`${mood.label} — ${mood.line}`}
            >
              <View
                style={[
                  styles.moodDisc,
                  isSuggested && { borderColor: mixHex(mood.accent, colors.line, 0.58) },
                  isOn && { backgroundColor: mood.accent, borderColor: mood.accent },
                ]}
              >
                <Face
                  mood={mood.id}
                  size={24}
                  color={isOn ? colors.ink : isSuggested ? mood.accent : colors.muted}
                />
              </View>
              <Text
                style={[
                  styles.moodChipLabel,
                  { color: isOn ? colors.text : isSuggested ? mood.accent : colors.muted },
                ]}
                numberOfLines={1}
              >
                {mood.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={({ pressed }) => [styles.moodChip, pressed && { transform: [{ scale: 0.94 }] }]}
          onPress={() => {
            setMood(null);
            onDiscover();
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: state.mood === null }}
          accessibilityLabel="Any — no mood on the deck"
        >
          <View
            style={[
              styles.moodDisc,
              state.mood === null && { backgroundColor: colors.text, borderColor: colors.text },
            ]}
          >
            <Text style={[styles.moodAny, state.mood === null && { color: colors.ink }]}>∞</Text>
          </View>
          <Text
            style={[styles.moodChipLabel, { color: state.mood === null ? colors.text : colors.muted }]}
          >
            Any
          </Text>
        </Pressable>
      </View>
      {state.prefs.moodByTime !== "off" ? (
        <Text style={styles.moodNudge}>{DAYPART_COPY[hour.part].nudge}</Text>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Your library</Text>
      </View>
      {libraryEmpty ? (
        // one invitation, not two empty boxes pretending to be a library
        <Pressable
          style={({ pressed }) => [styles.emptyLibrary, pressed && styles.pressed]}
          onPress={onNewPlaylist}
          accessibilityRole="button"
        >
          <View style={styles.emptyIcon}>
            <Feather name="heart" size={17} color={colors.save} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptySub}>
              Swipe a song down to keep it. Tap here, or hold +, to start a playlist.
            </Text>
          </View>
        </Pressable>
      ) : (
      <View style={styles.tiles}>
        <Pressable
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          onPress={() => onOpenLibrary("liked")}
        >
          <Mosaic tracks={liked} />
          <Text style={styles.tileName}>Liked Songs</Text>
          <Text style={styles.tileSub}>
            {liked.length} {liked.length === 1 ? "song" : "songs"}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          onPress={() => onOpenLibrary("discoveries")}
        >
          <Mosaic tracks={discoveries} />
          <Text style={styles.tileName}>Discoveries</Text>
          <Text style={styles.tileSub}>
            {discoveries.length} {discoveries.length === 1 ? "song" : "songs"}
          </Text>
        </Pressable>
        {playlists.map((p) => (
          <Pressable
            key={p.id}
            style={({ pressed }) => [
              styles.tile,
              { borderColor: mixHex(p.accent, colors.line, 0.45) },
              pressed && styles.pressed,
            ]}
            onPress={() => onOpenLibrary(`pl:${p.id}`)}
          >
            <Mosaic tracks={p.tracks} />
            <Text style={styles.tileName} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.tileSub}>
              {p.tracks.length} {p.tracks.length === 1 ? "song" : "songs"}
            </Text>
          </Pressable>
        ))}
      </View>
      )}

      {becauseRows.map((row) => (
        <View key={row.genre} style={styles.becauseWrap}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>
              Because you wanted more{" "}
              <Text style={{ color: accent }}>{row.genre}</Text>
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.rowScroll}
            contentContainerStyle={styles.rowScrollContent}
          >
            {row.tracks.map((t) => (
              <RowCard key={t.id} track={t} onPick={(id) => onDiscover(id)} />
            ))}
          </ScrollView>
        </View>
      ))}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Fresh for you</Text>
        <Text style={styles.sectionCount}>tap to play</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowScroll}
        contentContainerStyle={styles.rowScrollContent}
      >
        {fresh.map((t) => (
          <RowCard key={t.id} track={t} onPick={(id) => onDiscover(id)} />
        ))}
      </ScrollView>

      {liked.length > 0 && (
        <>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Recently saved</Text>
          </View>
          {liked.slice(0, 5).map((t) => (
            <Pressable
              key={t.id}
              style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
              onPress={() => onDiscover(t.id)}
            >
              <Image source={{ uri: art(t.artwork, 100) }} style={styles.listArt} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {t.title}
                </Text>
                <Text style={styles.listArtist} numberOfLines={1}>
                  {t.artist}
                </Text>
              </View>
              <Feather name="heart" size={14} color={colors.save} />
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  // extra bottom padding so content never scrolls under the protruding nav FAB
  content: { paddingHorizontal: 20, paddingBottom: 38 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  greeting: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    letterSpacing: 2.3,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 10,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 27,
    letterSpacing: -0.8,
    lineHeight: 32,
    color: colors.text,
    marginBottom: 20,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 24,
    padding: 22,
    marginBottom: 26,
  },
  ctaLabel: { fontFamily: fonts.displayBold, fontSize: 18, color: "#FFFFFF" },
  ctaSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    opacity: 0.72,
    marginTop: 4,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    letterSpacing: -0.1,
    color: colors.text,
  },
  sectionCount: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.muted },
  sectionAction: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  moodRow: { flexDirection: "row", gap: 2, paddingBottom: 2 },
  // circles, matching the ring: the face on the card, on the ring and here are
  // the same round object at three sizes
  moodChip: { flex: 1, minWidth: 0, alignItems: "center", gap: 7, paddingTop: 2, paddingBottom: 4 },
  moodDisc: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  moodChipLabel: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  moodAny: { fontFamily: fonts.body, fontSize: 19, lineHeight: 22, color: colors.muted },
  emptyLibrary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    marginBottom: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,229,160,0.12)",
  },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.text, marginBottom: 3 },
  emptySub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  moodNudge: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 10,
    marginBottom: 28,
  },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  becauseWrap: { marginBottom: 4 },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    maxWidth: "48.5%",
    borderRadius: radii.tile,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  mosaic: {
    flexDirection: "row",
    gap: 3,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface2,
    aspectRatio: 2,
    marginBottom: 12,
  },
  mosaicArt: { flex: 1, height: "100%" },
  mosaicEmpty: {
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  tileName: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.text },
  tileSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 3 },
  rowScroll: { marginHorizontal: -20, marginBottom: 28 },
  rowScrollContent: { paddingHorizontal: 20, gap: 12 },
  rowCard: {
    // width + flexShrink:0 — without an explicit cap a long nowrap artist
    // name stretches the card past 124 and breaks the row's rhythm
    width: 124,
    flexShrink: 0,
  },
  rowArt: {
    width: 124,
    height: 124,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
  rowArtist: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  listArt: { width: 46, height: 46, borderRadius: 10 },
  listTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  listArtist: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
});

