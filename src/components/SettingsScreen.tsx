import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useStore } from "../state/store";
import { colors, fonts, radii } from "../design/tokens";
import { GroupLabel, Row, RowGroup } from "./settings/kit";
import { BUILD_TAG } from "../buildInfo";

/**
 * Settings is a hub now, not one long column: five sections lead to their own
 * pages (Appearance / Playback / Gestures / Sound & taste / Data & privacy),
 * each a stack entry the hardware back button understands.
 */
export function SettingsScreen({
  onBack,
  onOpen,
  onOpenStats,
  onOpenProfile,
  signedIn,
  email,
  canViewStats = false,
}: {
  onBack: () => void;
  onOpenProfile: () => void;
  /** the signed-in account's address, when there is one */
  email?: string | null;
  onOpen: (page: "appearance" | "playback" | "gestures" | "sound" | "data" | "support") => void;
  onOpenStats: () => void;
  signedIn: boolean;
  /** admin or approved creator — reveals the Analytics row */
  canViewStats?: boolean;
}) {
  const { state } = useStore();

  const motionLabel =
    state.prefs.motion === "full" ? "Full" : state.prefs.motion === "reduced" ? "Reduced" : "Off";

  return (
    <View style={styles.screen}>
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
          hookedcue<Text style={{ color: colors.accentDefault }}>.</Text>
        </Text>
        <View style={{ width: 42, height: 42 }} />
      </View>

      <Animated.ScrollView
        entering={FadeInDown.springify().stiffness(300).damping(30)}
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        {/* three short cards — the same groups, order and icons as web */}
        <GroupLabel>listening</GroupLabel>
        <RowGroup>
          <Row
            icon="play"
            iconColor={colors.more}
            label="Playback"
            sub={`auto-advance ${state.autoAdvance ? "on" : "off"} · save target`}
            chevron
            onPress={() => onOpen("playback")}
          />
          <Row
            icon="move"
            iconColor={colors.save}
            label="Gestures"
            sub={`swipe distance · haptics ${state.prefs.haptics}`}
            chevron
            onPress={() => onOpen("gestures")}
          />
          <Row
            icon="music"
            iconColor={colors.accentDefault}
            label="Sound & taste"
            sub="languages, genres, blocked artists, replays"
            chevron
            onPress={() => onOpen("sound")}
          />
        </RowGroup>

        <GroupLabel>you</GroupLabel>
        <RowGroup>
          <Row
            icon="user"
            label="Account"
            sub={signedIn && email ? email : "sign in to keep your taste forever"}
            chevron
            onPress={onOpenProfile}
          />
          <Row
            icon="droplet"
            iconColor={state.prefs.accentMode === "custom" ? state.prefs.accentColor : colors.accentDefault}
            label="Appearance"
            sub={`accent · motion ${motionLabel.toLowerCase()}`}
            chevron
            onPress={() => onOpen("appearance")}
          />
          <Row
            icon="shield"
            label="Data & privacy"
            sub="export, reset, delete account"
            chevron
            onPress={() => onOpen("data")}
          />
        </RowGroup>

        {/* the same third card as the web: support, creators, and staff tools */}
        <GroupLabel>hookedcue</GroupLabel>
        <RowGroup>
          <Row
            icon="heart"
            iconColor={state.prefs.adsOptOut ? colors.muted : colors.accentDefault}
            label="Support hookedcue"
            sub={state.prefs.adsOptOut ? "house ads off" : "house ads on"}
            chevron
            onPress={() => onOpen("support")}
          />
          <Row
            icon="mic"
            iconColor={colors.more}
            label="Creator dashboard"
            // Deliberately not a link: the dashboard is where artists buy
            // promotion, and Google Play forbids leading app users to a
            // payment outside Play Billing (docs/PROMOTIONS.md). So the phone
            // only says where it is.
            sub="on the web, at app.hookedcue.com"
          />
          {canViewStats && (
            <Row
              icon="bar-chart-2"
              iconColor={colors.accentDefault}
              label="Analytics"
              sub="live deck numbers · your tracks"
              chevron
              onPress={onOpenStats}
            />
          )}
        </RowGroup>
        {/* which bundle this phone is running — was a faint line on the deck */}
        <Text style={styles.foot}>hookedcue · {BUILD_TAG}</Text>
      </Animated.ScrollView>
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
  body: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 },
  foot: {
    marginTop: 22,
    marginBottom: 6,
    textAlign: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.muted,
    opacity: 0.7,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.text,
    marginBottom: 4,
  },
});





