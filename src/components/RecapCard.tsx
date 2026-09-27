import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { colors, fonts, mixHex } from "../design/tokens";
import { MOODS } from "../data/mood";
import { isRecapDay, recapStoryUrl } from "../lib/growth";
import { Face } from "./faces";

type Recap =
  | { ready: false; cards: number; minCards: number }
  | {
      ready: true;
      since: number;
      until: number;
      firstName: string | null;
      cards: number;
      saves: number;
      newArtists: number;
      saveRate: number;
      topArtists: string[];
      topMoods: string[];
    };

/**
 * "Your week in hooks" — the web's RecapCard, ported. On Home on Sundays and
 * Mondays for a listener with an account and a few cards behind them this
 * week (convex/recap.ts). Sharing sends the story image's link — a picture of
 * the numbers, never the account.
 */
export function RecapCard() {
  const show = isRecapDay(new Date());
  const recap = useQuery(anyApi.recap.week, show ? {} : "skip") as Recap | null | undefined;

  if (!show || !recap || !recap.ready) return null;

  const imageUrl = recapStoryUrl({
    firstName: recap.firstName,
    cards: recap.cards,
    saves: recap.saves,
    newArtists: recap.newArtists,
    saveRate: recap.saveRate,
    topMoods: recap.topMoods,
    topArtist: recap.topArtists[0] ?? null,
    until: recap.until,
  });

  const share = () => {
    Share.share({ message: `my week in hooks on hookedcue ${imageUrl}`, url: imageUrl, title: "my week in hooks" }).catch(
      () => void Linking.openURL(imageUrl),
    );
  };

  const moods = recap.topMoods
    .map((id) => MOODS.find((m) => m.id === id))
    .filter((m): m is (typeof MOODS)[number] => Boolean(m));

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel="your week in hooks">
      <Text style={styles.kicker}>YOUR WEEK IN HOOKS</Text>
      <Text style={styles.big}>
        <Text style={styles.bigNum}>{recap.cards}</Text> intros skipped
      </Text>
      <Text style={styles.sub}>every one of them started at its hook</Text>
      <View style={styles.stats}>
        <Text style={styles.stat}>
          <Text style={styles.statNum}>{recap.saves}</Text> saved
        </Text>
        <Text style={styles.stat}>
          <Text style={styles.statNum}>{recap.newArtists}</Text> new {recap.newArtists === 1 ? "artist" : "artists"}
        </Text>
        <Text style={styles.stat}>
          <Text style={styles.statNum}>{Math.round(recap.saveRate * 100)}%</Text> save rate
        </Text>
      </View>
      {moods.length > 0 ? (
        <View style={styles.moods}>
          {moods.map((m) => (
            <View key={m.id} style={[styles.mood, { borderColor: mixHex(m.accent, colors.line, 0.5) }]}>
              <Face mood={m.id} size={18} color={m.accent} cut={colors.surface} />
              <Text style={[styles.moodLabel, { color: m.accent }]}>{m.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {recap.topArtists[0] ? <Text style={styles.artist}>on repeat: {recap.topArtists[0]}</Text> : null}
      <Pressable
        style={({ pressed }) => [styles.share, pressed && { opacity: 0.7 }]}
        onPress={share}
        accessibilityRole="button"
      >
        <Text style={styles.shareText}>Share your week</Text>
      </Pressable>
    </View>
  );
}

// web .recap-card and friends
const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: mixHex(colors.accentDefault, colors.line, 0.35),
    padding: 18,
    marginTop: 18,
  },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1.4, color: colors.accentDefault },
  big: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, marginTop: 8 },
  bigNum: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 14 },
  stat: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  statNum: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  moods: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  mood: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  moodLabel: { fontFamily: fonts.bodyBold, fontSize: 12 },
  artist: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.text, marginTop: 12 },
  share: {
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: colors.accentDefault,
    paddingVertical: 13,
    alignItems: "center",
  },
  shareText: { fontFamily: fonts.displayBold, fontSize: 15, color: "#0B0B10" },
});
