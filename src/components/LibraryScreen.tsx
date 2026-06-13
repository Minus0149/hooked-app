import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
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
          >
            <Feather name="x" size={18} color={colors.never} />
          </Pressable>
        ) : (
          <View style={{ width: 42, height: 42 }} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
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
        </Animated.View>

        {tracks.length === 0 ? (
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
        ) : (
          tracks.map((t, i) => (
            <Animated.View
              key={t.id}
              entering={FadeInDown.delay(Math.min(i, 10) * 45)
                .springify()
                .stiffness(260)
                .damping(26)}
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
              >
                <Feather name="x" size={15} color={colors.muted} />
              </Pressable>
            </Animated.View>
          ))
        )}
        <View style={{ height: 10 }} />
      </ScrollView>
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
  topBtnText: { color: colors.text, fontSize: 16 },
  body: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 8,
    marginBottom: 18,
  },
  collage: { width: 108, height: 108, flexShrink: 0 },
  collageArt: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(8,8,12,0.9)",
  },
  collageEmpty: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  heroMeta: { flex: 1, minWidth: 0 },
  kicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 1.7,
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.4,
    color: colors.text,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 5,
  },

  ctas: { flexDirection: "row", gap: 10, marginBottom: 20 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.pill,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaGhost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    fontFamily: fonts.displayBold,
    fontSize: 12.5,
    color: colors.ink,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
    marginBottom: 2,
  },
  index: {
    width: 22,
    flexShrink: 0,
    fontFamily: fonts.displayBold,
    fontSize: 11,
    textAlign: "right",
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowArt: { width: 46, height: 46, borderRadius: 11, flexShrink: 0 },
  rowMeta: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  rowArtist: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  rowGenre: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
    maxWidth: 74,
    flexShrink: 0,
  },
  rowBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  empty: {
    padding: 22,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.line,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
  },
});
