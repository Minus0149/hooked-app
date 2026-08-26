import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { useStore } from "../state/store";
import { AD_FREQUENCIES, AD_UNITS, AD_UNIT_BOUNDS } from "../data/prefs";
import { colors, fonts, radii } from "../design/tokens";
import { Row } from "./settings/kit";

/**
 * The Support module: what the house ads are, how often they run right now
 * (live config), and the opt-out — which asks once, honestly, because those
 * cards are what keeps an independent deck independent.
 */
function SupportCard() {
  const { state, setPrefs } = useStore();
  const optedOut = state.prefs.adsOptOut;
  const setPrefsMutation = useMutation(anyApi.library.setPrefs);
  const adsConfig = useQuery(anyApi.ads.getConfig) as
    | { enabled: boolean; everyNSwipes: number; maxPerDay: number }
    | null
    | undefined;

  const confirmOptOut = () => {
    Alert.alert(
      "Before you go…",
      "hooked has no investors and no label money. Those few quiet cards between songs pay for the servers and keep this deck independent.\n\nTurning them off costs you nothing — but if everyone does, the music goes quiet with them. Whatever you choose, it stays your call.",
      [
        {
          text: "Keep them on",
          style: "default",
          onPress: () => {
            setPrefs({ adsOptOut: false });
            void setPrefsMutation({
              motion: state.prefs.motion,
              haptics: state.prefs.haptics,
              accentMode: state.prefs.accentMode,
              accentColor: state.prefs.accentColor,
              swipeSensitivity: state.prefs.swipeSensitivity,
              adsOptOut: false,
            }).catch(() => undefined);
          },
        },
        {
          text: "Turn them off anyway",
          style: "destructive",
          onPress: () => {
            setPrefs({ adsOptOut: true });
            void setPrefsMutation({
              motion: state.prefs.motion,
              haptics: state.prefs.haptics,
              accentMode: state.prefs.accentMode,
              accentColor: state.prefs.accentColor,
              swipeSensitivity: state.prefs.swipeSensitivity,
              adsOptOut: true,
            }).catch(() => undefined);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.support}>
      <Text style={styles.supportTitle}>Support hooked</Text>
      <Text style={styles.supportSub}>
        {optedOut
          ? "Ads are off. They'll stay off until you say otherwise."
          : adsConfig?.enabled
            ? `A small sponsored card every ~${adsConfig.everyNSwipes} swipes, never more than ${adsConfig.maxPerDay} a day. Music never stops for one.`
            : "No cards are being shown right now."}
      </Text>
      <View style={styles.supportRow}>
        <Pressable
          style={[styles.supportChip, !optedOut && styles.chipOn]}
          onPress={() => setPrefs({ adsOptOut: false })}
          accessibilityRole="radio"
          accessibilityState={{ selected: !optedOut }}
        >
          <Text style={[styles.chipText, !optedOut && styles.chipTextOn]}>
            On · keep it independent
          </Text>
        </Pressable>
        <Pressable
          style={[styles.supportChip, optedOut && styles.chipOn]}
          onPress={() => (optedOut ? setPrefs({ adsOptOut : false }) : confirmOptOut())}
          accessibilityRole="radio"
          accessibilityState={{ selected: optedOut }}
        >
          <Text style={[styles.chipText, optedOut && styles.chipTextOn]}>Off</Text>
        </Pressable>
      </View>
      {!optedOut && (
        <>
          <Text style={styles.freqLabel}>how often</Text>
          <View style={styles.supportRow}>
            {AD_FREQUENCIES.map((f) => (
              <Pressable
                key={f.id}
                style={[
                  styles.supportChip,
                  state.prefs.adCadence === null &&
                    state.prefs.adFrequency === f.id &&
                    styles.chipOn,
                ]}
                onPress={() => setPrefs({ adFrequency: f.id, adCadence: null })}
                accessibilityRole="radio"
                accessibilityState={{
                  selected:
                    state.prefs.adCadence === null &&
                    state.prefs.adFrequency === f.id,
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    state.prefs.adCadence === null &&
                      state.prefs.adFrequency === f.id &&
                      styles.chipTextOn,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.freqLabel}>your own pace</Text>
          <View style={styles.supportRow}>
            {AD_UNITS.map((u) => (
              <Pressable
                key={u.id}
                style={[
                  styles.supportChip,
                  state.prefs.adCadence?.unit === u.id && styles.chipOn,
                ]}
                onPress={() => {
                  const defaults: Record<string, number> = {
                    swipes: 12, minutes: 30, hours: 2, day: 1,
                  };
                  setPrefs({
                    adCadence: { unit: u.id, value: defaults[u.id] ?? 12 },
                  });
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: state.prefs.adCadence?.unit === u.id }}
              >
                <Text
                  style={[
                    styles.chipText,
                    state.prefs.adCadence?.unit === u.id && styles.chipTextOn,
                  ]}
                >
                  {u.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {state.prefs.adCadence && (
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => {
                  const b = AD_UNIT_BOUNDS[state.prefs.adCadence!.unit];
                  setPrefs({
                    adCadence: {
                      unit: state.prefs.adCadence!.unit,
                      value: Math.max(b.min, state.prefs.adCadence!.value - b.step),
                    },
                  });
                }}
                accessibilityLabel="less frequent"
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepValue}>
                {state.prefs.adCadence.unit === "swipes" && (
                  <>every <Text style={styles.stepValueStrong}>{state.prefs.adCadence.value}</Text> swipes</>
                )}
                {state.prefs.adCadence.unit === "minutes" && (
                  <>every <Text style={styles.stepValueStrong}>{state.prefs.adCadence.value}</Text> min</>
                )}
                {state.prefs.adCadence.unit === "hours" && (
                  <>every <Text style={styles.stepValueStrong}>{state.prefs.adCadence.value}</Text> h</>
                )}
                {state.prefs.adCadence.unit === "day" && (
                  <Text style={styles.stepValueStrong}>{state.prefs.adCadence.value} / day</Text>
                )}
              </Text>
              <Pressable
                style={styles.stepBtn}
                onPress={() => {
                  const b = AD_UNIT_BOUNDS[state.prefs.adCadence!.unit];
                  setPrefs({
                    adCadence: {
                      unit: state.prefs.adCadence!.unit,
                      value: Math.min(b.max, state.prefs.adCadence!.value + b.step),
                    },
                  });
                }}
                accessibilityLabel="more frequent"
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.freqNote}>
            the daily and weekly ceilings set by hooked always hold
          </Text>
        </>
      )}
    </View>
  );
}

/**
 * Settings is a hub now, not one long column: five sections lead to their own
 * pages (Appearance / Playback / Gestures / Sound & taste / Data & privacy),
 * each a stack entry the hardware back button understands.
 */
export function SettingsScreen({
  onBack,
  onOpen,
  onOpenStats,
  signedIn,
  canViewStats = false,
}: {
  onBack: () => void;
  onOpen: (page: "appearance" | "playback" | "gestures" | "sound" | "data") => void;
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
          hooked<Text style={{ color: colors.accentDefault }}>.</Text>
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

        <Row
          icon="droplet"
          iconColor={state.prefs.accentMode === "custom" ? state.prefs.accentColor : colors.accentDefault}
          label="Appearance"
          sub={`accent · motion ${motionLabel.toLowerCase()}`}
          chevron
          onPress={() => onOpen("appearance")}
        />
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
        {canViewStats && (
          <Row
            icon="bar-chart-2"
            iconColor={colors.more}
            label="Analytics"
            sub="live deck numbers · your tracks"
            chevron
            onPress={onOpenStats}
          />
        )}

        <Row
          icon="shield"
          label="Data & privacy"
          sub="export, reset, delete account"
          chevron
          onPress={() => onOpen("data")}
        />

        <SupportCard />
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
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.text,
    marginBottom: 14,
  },
  support: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 8,
  },
  supportTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.muted,
  },
  supportSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    opacity: 0.85,
  },
  supportRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  freqLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.muted,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  stepBtn: {
    width: 42,
    height: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.text },
  stepValue: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  stepValueStrong: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  freqNote: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.muted,
  },
  supportChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  chipOn: {
    backgroundColor: colors.accentDefault,
    borderColor: colors.accentDefault,
  },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
  chipTextOn: { color: colors.ink },
});





