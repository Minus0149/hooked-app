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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "up late";
  if (h < 12) return "good morning";
  if (h < 18) return "good afternoon";
  return "good evening";
}

// Two-cell artwork mosaic for a library tile; muted placeholders when empty
function Mosaic({ tracks }: { tracks: Track[] }) {
  const cells = tracks.slice(0, 2);
  return (
    <View style={styles.mosaic}>
      {cells.map((t) => (
        <Image key={t.id} source={{ uri: art(t.artwork, 200) }} style={styles.mosaicArt} />
      ))}
      {Array.from({ length: 2 - cells.length }).map((_, i) => (
        <View key={i} style={[styles.mosaicArt, styles.mosaicEmpty]}>
          <Feather name="heart" size={15} color="#3C3C48" />
        </View>
      ))}
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
  const { state } = useStore();
  const { liked, discoveries, playlists, queue } = state;

  const fresh = useMemo(() => queue.slice(0, 10), [queue]);

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
          <Text style={styles.ctaLabel}>Start discovering</Text>
          <Text style={styles.ctaSub}>{queue.length} songs queued for you</Text>
        </View>
        <Eq color="#FFFFFF" playing />
      </Pressable>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Your library</Text>
        <Pressable onPress={onNewPlaylist} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: accent }]}>+ new playlist</Text>
        </Pressable>
      </View>
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
    color: "rgba(255,255,255,0.75)",
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
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
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
  rowCard: { width: 124 },
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
