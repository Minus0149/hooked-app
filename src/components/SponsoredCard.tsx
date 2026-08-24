import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutDown,
  ZoomIn,
} from "react-native-reanimated";
import { colors, fonts, radii } from "../design/tokens";

/**
 * The house-ad interstitial between swipes.
 *
 * Same contract as web's SponsoredCard: music never stops for it, it sits
 * above the deck, one obvious action, leaving is always one tap.
 */

export interface AdCardData {
  id: string;
  advertiser: string;
  title: string;
  body?: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string | null;
  accent: string;
}

export function SponsoredCard({
  ad,
  onSkip,
  onOpen,
}: {
  ad: AdCardData;
  onSkip: () => void;
  /** opens the CTA URL externally; the click event is recorded by the parent */
  onOpen: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.springify().stiffness(320).damping(28)}
      exiting={FadeOutDown.duration(180)}
      style={styles.wrap}
    >
      <View style={[styles.card, { borderColor: `${ad.accent}55` }]}>
        <View style={styles.topRow}>
          <Text style={styles.chip}>SPONSORED</Text>
          <Pressable onPress={onSkip} hitSlop={8} accessibilityLabel="close this ad">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {ad.imageUrl ? (
            <Image source={{ uri: ad.imageUrl }} style={styles.art} resizeMode="cover" />
          ) : (
            <View style={[styles.artBlank, { backgroundColor: ad.accent }]} />
          )}
          <Text style={styles.advertiser}>{ad.advertiser.toUpperCase()}</Text>
          <Text style={styles.title}>{ad.title}</Text>
          {!!ad.body && <Text style={styles.sub}>{ad.body}</Text>}
          <Animated.View entering={ZoomIn.delay(120).springify()}>
            <Pressable
              onPress={onOpen}
              style={({ pressed }) => [styles.cta, { backgroundColor: ad.accent }, pressed && { opacity: 0.85 }]}
              accessibilityRole="link"
            >
              <Text style={styles.ctaText}>{ad.ctaLabel}</Text>
            </Pressable>
          </Animated.View>
        </View>

        <Pressable onPress={onSkip} style={styles.skipRow}>
          <Text style={styles.skip}>no thanks</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 64,
    left: 16,
    right: 16,
    bottom: 96,
    zIndex: 40,
  },
  card: {
    flex: 1,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    padding: 18,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: {
    fontSize: 10,
    letterSpacing: 2,
    color: colors.muted,
    fontFamily: fonts.bodyBold,
  },
  close: { color: colors.muted, fontSize: 15, paddingHorizontal: 6 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  art: { width: 128, height: 128, borderRadius: 20, marginBottom: 8 },
  artBlank: { width: 128, height: 128, borderRadius: 20, marginBottom: 8 },
  advertiser: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 21,
    color: colors.text,
    textAlign: "center",
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  cta: {
    marginTop: 12,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: radii.pill,
  },
  ctaText: { color: "#0b0b10", fontFamily: fonts.bodyBold, fontSize: 14 },
  skipRow: { alignItems: "center", paddingTop: 10 },
  skip: { color: colors.muted, fontSize: 13 },
});
