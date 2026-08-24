import { memo } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOutLeft } from "react-native-reanimated";
import { useStore } from "../state/store";
import type { LibraryContainer, Track } from "../types";
import { colors, fonts, mixHex, radii, withAlpha } from "../design/tokens";
import { art } from "../lib/art";

function totalMinutes(tracks: Track[]) {
  // previews are ~30s each; show the full-song runtime for flavor
  const ms = tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
  return Math.max(1, Math.round(ms / 60_000));
}

// 4-artwork scattered collage with slight alternating rotations (web's
// .library-collage nth-child layout)
const COLLAGE_POS = [
  { top: 0, left: 0, zIndex: 4 },
  { top: 6, right: 0, zIndex: 3 },
  { bottom: 0, left: 8, zIndex: 2 },
  { bottom: 4, right: 6, zIndex: 1 },
] as const;

/**
 * One track row. Memoized and rendered through a FlatList: mapping every
 * saved song into its own animated view made libraries of hundreds of songs
 * jank on mount and scroll.
 */
const TrackRow = memo(function TrackRow({
  t,
  i,
  accent,
  onPlay,
  onRemove,
}: {
  t: Track;
  i: number;
  accent: string;
  onPlay: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(i, 10) * 45)
        .springify()
        .stiffness(260)
        .damping(26)}
      exiting={FadeOutLeft.duration(160)}
      style={styles.row}
    >
      <Text style={[styles.index, { color: mixHex(accent, colors.muted, 0.75) }]}>
        {String(i + 1).padStart(2, "0")}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.7 }]}
        onPress={() => onPlay(t.id)}
      >
        <Image source={{ uri: art(t.artwork, 100) }} style={styles.rowArt} />
        <View style={styles.rowMeta}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {t.title}
          </Text>
          <Text style={styles.rowArtist} numberOfLines={1}>
            {t.artist}
          </Text>
        </View>
      </Pressable>
      <Text style={styles.rowGenre} numberOfLines={1}>
        {t.genre.toUpperCase()}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.rowBtn, pressed && { opacity: 0.6 }]}
        onPress={() => onRemove(t.id)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`remove ${t.title}`}
      >
        <Feather name="x" size={15} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
});

export function LibraryScreen({
  container,
  onBack,
  onPlay,
  onRemove,
  onDeletePlaylist,
  onDiscoverInto,
}: {
  container: LibraryContainer;
  onBack: () => void;
  onPlay: (trackId: string) => void;
  onRemove: (trackId: string) => void;
  onDeletePlaylist: (id: string) => void;
  onDiscoverInto: (container: LibraryContainer) => void;
}) {
  const { state } = useStore();

  let title: string;
  let tracks: Track[];
  let accent = colors.accentDefault;
  let playlistId: string | null = null;
  let icon: keyof typeof Feather.glyphMap = "folder";

  if (container === "liked") {
    title = "Liked Songs";
    tracks = state.liked;
    accent = colors.save;
    icon = "heart";
  } else if (container === "discoveries") {
    title = "Discoveries";
    tracks = state.discoveries;
    accent = colors.more;
  } else {
    playlistId = container.slice(3);
    const pl = state.playlists.find((p) => p.id === playlistId);
    title = pl?.name ?? "Playlist";
    tracks = pl?.tracks ?? [];
    accent = pl?.accent ?? accent;
  }

  const collage = tracks.slice(0, 4);
  const isSaveTarget = state.saveTarget === container;

  const confirmDelete = () => {
    Alert.alert(
      "Delete playlist",
      `Delete "${title}"? The songs leave your library too.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDeletePlaylist(playlistId!);
            onBack();
          },
        },
      ],
    );
  };

  const header = (
    <Animated.View entering={FadeInDown.springify().stiffness(260).damping(26)}>
      <View style={styles.hero}>
        <View style={styles.collage}>
          {collage.map((t, i) => (
            <Image
              key={t.id}
              source={{ uri: art(t.artwork, 200) }}
              style={[
                styles.collageArt,
                COLLAGE_POS[i],
                { transform: [{ rotate: `${(i % 2 ? 1 : -1) * (2 + i)}deg` }] },
              ]}
            />
          ))}
          {collage.length === 0 && (
            <View
              style={[
                styles.collageEmpty,
                { borderColor: mixHex(accent, colors.line, 0.5) },
              ]}
            >
              <Feather name={icon} size={18} color={accent} />
            </View>
          )}
        </View>
        <View style={styles.heroMeta}>
          <Text style={[styles.kicker, { color: accent }]} numberOfLines={1}>
            <Feather name={icon} size={10.5} color={accent} />{" "}
            {playlistId ? "PLAYLIST" : "COLLECTION"}
            {isSaveTarget && (
              <Text style={{ color: colors.save }}> · saving here</Text>
            )}
          </Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>
            {tracks.length} {tracks.length === 1 ? "song" : "songs"}
            {tracks.length > 0 && ` · ~${totalMinutes(tracks)} min of music`}
          </Text>
        </View>
      </View>

      <View style={styles.ctas}>
        <Pressable
          disabled={tracks.length === 0}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: accent, shadowColor: accent },
            tracks.length === 0 && { opacity: 0.35 },
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
          onPress={() => tracks[0] && onPlay(tracks[0].id)}
        >
          <Feather name="play" size={13} color={colors.ink} />
          <Text style={styles.ctaText}>Play</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            styles.ctaGhost,
            { borderColor: mixHex(accent, colors.line, 0.45) },
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
          onPress={() => onDiscoverInto(container)}
        >
          <Feather name="zap" size={13} color={colors.text} />
          <Text style={[styles.ctaText, { color: colors.text }]}>
            Discover into this
          </Text>
        </Pressable>
      </View>

      {tracks.length === 0 && (
        <Animated.View
          entering={FadeInDown.delay(80).springify().stiffness(260).damping(26)}
          style={styles.empty}
        >
          <Text style={styles.emptyText}>
            Nothing in here yet. Hit{" "}
            <Text style={{ color: accent, fontFamily: fonts.bodyBold }}>
              Discover into this
            </Text>{" "}
            — every song you swipe down will land right here.
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );

  return (
    <View style={styles.screen}>
      {/* accent glow bleeding from behind the header */}
      <LinearGradient
        colors={[withAlpha(accent, 0.22), "rgba(8,8,12,0)"]}
        style={styles.heroGlow}
        pointerEvents="none"
      />

      <View style={styles.topbar}>
        <Pressable
          style={({ pressed }) => [styles.topBtn, pressed && { transform: [{ scale: 0.92 }] }]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="back"
        >
          <Feather name="corner-up-left" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.wordmark}>
          hooked<Text style={{ color: accent }}>.</Text>
        </Text>
        {playlistId ? (
          <Pressable
            style={({ pressed }) => [styles.topBtn, pressed && { transform: [{ scale: 0.92 }] }]}
            onPress={confirmDelete}
            accessibilityRole="button"
            accessibilityLabel="delete playlist"
          >
            <Feather name="x" size={18} color={colors.never} />
          </Pressable>
        ) : (
          <View style={{ width: 42, height: 42 }} />
        )}
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={tracks}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <TrackRow t={item} i={index} accent={accent} onPlay={onPlay} onRemove={onRemove} />
        )}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      />
      <View style={{ height: 10 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroGlow: {
    position: "absolute",
    top: 0,
    left: -40,
    right: -40,
    height: 240,
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.3,
  },
  topBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 18,
  },
  collage: { width: 96, height: 96 },
  collageArt: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  collageEmpty: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
  },
  heroMeta: { flex: 1, minWidth: 0, gap: 3 },
  kicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.text,
  },
  sub: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  ctas: { flexDirection: "row", gap: 10, marginBottom: 14 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
  },
  ctaGhost: { backgroundColor: "transparent", borderWidth: 1 },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  empty: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    marginTop: 4,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 2,
  },
  index: {
    fontFamily: fonts.display,
    fontSize: 11,
    width: 22,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  rowArt: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surface2 },
  rowMeta: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text },
  rowArtist: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.muted },
  rowGenre: {
    fontFamily: fonts.bodyBold,
    fontSize: 8.5,
    letterSpacing: 0.8,
    color: colors.muted,
    maxWidth: 64,
  },
  rowBtn: { padding: 6 },
});
