import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { authClient } from "../lib/auth-client";
import { useStore } from "../state/store";
import { colors, fonts, radii } from "../design/tokens";
import { art } from "../lib/art";
import { AuthForm } from "./AuthForm";
import { AccessGate } from "./AccessGate";

const ENTER = (i: number) => FadeInDown.duration(320).delay(i * 70);

/**
 * Web's ProfileScreen, ported: signed out → sign in (or, from "Not in the beta
 * yet? Apply", the beta application); signed in → account header + the local
 * taste dashboard (stats, top genres, recent saves) and a sign-out button.
 */
export function ProfileScreen({
  accent,
  onBack,
  onPlay,
}: {
  accent: string;
  onBack: () => void;
  onPlay: (trackId: string) => void;
}) {
  const session = authClient.useSession();
  const { state } = useStore();
  // "Not in the beta yet? Apply" swaps the sign-in form for the application
  const [applying, setApplying] = useState(false);
  const { liked, discoveries, playlists, neverArtists } = state;

  const topGenres = useMemo(() => {
    const all = [...liked, ...discoveries, ...playlists.flatMap((p) => p.tracks)];
    const counts = new Map<string, number>();
    for (const t of all) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [liked, discoveries, playlists]);

  const tiles: { heart?: boolean; name: string; sub: string }[] = [
    {
      heart: true,
      name: "Liked",
      sub: `${liked.length} ${liked.length === 1 ? "song" : "songs"}`,
    },
    {
      name: "Discoveries",
      sub: `${discoveries.length} ${discoveries.length === 1 ? "song" : "songs"}`,
    },
    { name: "Playlists", sub: `${playlists.length} created` },
    { name: "Blocked artists", sub: `${neverArtists.length} never again` },
  ];

  const signedIn = !!session.data;
  const email = session.data?.user.email ?? "";

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable
          style={({ pressed }) => [styles.topBtn, pressed && { transform: [{ scale: 0.92 }] }]}
          onPress={onBack}
        >
          <Feather name="corner-up-left" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.wordmark}>
          hookedcue<Text style={{ color: accent }}>.</Text>
        </Text>
        <View style={{ width: 42, height: 42 }} />
      </View>

      {session.isPending ? null : !signedIn && applying ? (
        <AccessGate
          inline
          freeSwipes={0}
          accent={accent}
          intro={{
            kicker: "join the beta",
            copy: "hookedcue is invite-only while it's in testing. Leave your email and we'll send you an invite when you're in.",
          }}
          onSignIn={() => setApplying(false)}
        />
      ) : !signedIn ? (
        <AuthForm accent={accent} onApply={() => setApplying(true)} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={ENTER(0)} style={styles.hero}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: accent, shadowColor: accent },
              ]}
            >
              <Text style={styles.avatarText}>
                {(email || "?").slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.heroEmail}>{email}</Text>
            <View style={styles.heroSubRow}>
              <Feather name="check" size={13} color={colors.save} />
              <Text style={styles.heroSub}>
                Your swipes and library sync to the cloud
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={ENTER(1)} style={styles.tiles}>
            {tiles.map((t) => (
              <View key={t.name} style={styles.tile}>
                <View style={styles.tileNameRow}>
                  {t.heart && (
                    <Feather name="heart" size={13} color={colors.save} />
                  )}
                  <Text style={styles.tileName}>{t.name}</Text>
                </View>
                <Text style={styles.tileSub}>{t.sub}</Text>
              </View>
            ))}
          </Animated.View>

          {topGenres.length > 0 && (
            <Animated.View entering={ENTER(2)}>
              <Text style={styles.group}>your taste</Text>
              <View style={styles.chips}>
                {topGenres.map(([genre, count], i) => (
                  <View
                    key={genre}
                    style={[
                      styles.chip,
                      i === 0 && { borderColor: accent },
                    ]}
                  >
                    <Text
                      style={[styles.chipText, i === 0 && { color: accent }]}
                    >
                      {genre} · {count}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {liked.length > 0 && (
            <Animated.View entering={ENTER(3)}>
              <Text style={styles.group}>recently saved</Text>
              {liked.slice(0, 5).map((t) => (
                <Pressable
                  key={t.id}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  onPress={() => onPlay(t.id)}
                >
                  <Image source={{ uri: art(t.artwork, 100) }} style={styles.rowArt} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={styles.rowArtist} numberOfLines={1}>
                      {t.artist}
                    </Text>
                  </View>
                  <Feather name="heart" size={14} color={colors.save} />
                </Pressable>
              ))}
            </Animated.View>
          )}

          {liked.length === 0 && topGenres.length === 0 && (
            <Animated.View entering={ENTER(2)}>
              <Text style={styles.empty}>
                Swipe a few songs and your taste shows up here.
              </Text>
            </Animated.View>
          )}

          <Animated.View entering={ENTER(4)}>
            <Pressable
              style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
              onPress={() => void authClient.signOut()}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  body: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  hero: { alignItems: "center", gap: 10, marginBottom: 22 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  heroEmail: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  heroSubRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroSub: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 10 },
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
  tileNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  tileSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 3 },
  group: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 18,
    marginBottom: 10,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  rowArt: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.surface2,
  },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  rowArtist: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  empty: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.muted,
    textAlign: "center",
    marginTop: 12,
  },
  signOut: {
    marginTop: 26,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  signOutText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: colors.never,
  },
});
