import { useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../state/store";
import { colors, fonts, radii } from "../design/tokens";

/** Animated track+knob switch matching web's .toggle — save-green when on. */
function Toggle({ on }: { on: boolean }) {
  const v = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    v.value = withTiming(on ? 1 : 0, { duration: 200 });
  }, [on]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [colors.surface2, colors.save]),
    borderColor: interpolateColor(v.value, [0, 1], [colors.line, colors.save]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: v.value * 17 }],
  }));

  return (
    <Animated.View style={[styles.toggle, trackStyle]}>
      <Animated.View style={[styles.toggleKnob, knobStyle]} />
    </Animated.View>
  );
}

function Row({
  icon,
  iconColor,
  label,
  labelColor,
  sub,
  right,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
  label: string;
  labelColor?: string;
  sub: string;
  right?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Feather name={icon} size={17} color={iconColor ?? colors.text} />
      </View>
      <View style={styles.rowLabelWrap}>
        <Text style={[styles.rowLabel, labelColor != null && { color: labelColor }]}>
          {label}
        </Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {right}
    </Pressable>
  );
}

export function SettingsScreen({
  onBack,
  onOpenSaveTarget,
  onReplayTutorial,
  onResetData,
}: {
  onBack: () => void;
  onOpenSaveTarget: () => void;
  onReplayTutorial: () => void;
  onResetData: () => void;
}) {
  const { state, setAutoAdvance } = useStore();

  const targetLabel =
    state.saveTarget === "liked"
      ? "Liked Songs"
      : state.saveTarget === "discoveries"
        ? "Discoveries"
        : (state.playlists.find((p) => `pl:${p.id}` === state.saveTarget)?.name ??
          "Liked Songs");

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
          hooked<Text style={{ color: colors.accentDefault }}>.</Text>
        </Text>
        <View style={{ width: 42, height: 42 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.group}>swiping</Text>
        <Row
          icon={state.saveTarget === "liked" ? "heart" : "folder"}
          iconColor={colors.save}
          label="Swipe down saves to"
          sub={targetLabel}
          right={<Text style={styles.rowValue}>change</Text>}
          onPress={onOpenSaveTarget}
        />
        <Row
          icon="play"
          iconColor={colors.more}
          label="Auto-advance"
          sub="jump to the next song when a preview ends"
          right={<Toggle on={state.autoAdvance} />}
          onPress={() => setAutoAdvance(!state.autoAdvance)}
        />

        <Text style={styles.group}>app</Text>
        <Row
          icon="rotate-ccw"
          label="Replay the swipe tutorial"
          sub="relearn the four gestures"
          onPress={onReplayTutorial}
        />
        <Row
          icon="x"
          iconColor={colors.never}
          label="Reset local data"
          labelColor={colors.never}
          sub="clears your library and history on this device"
          onPress={() =>
            Alert.alert(
              "Reset local data",
              "Clear your local library and history on this device?",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Reset", style: "destructive", onPress: onResetData },
              ],
            )
          }
        />
      </ScrollView>
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
  topBtnText: { color: colors.text, fontSize: 16 },
  body: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.text,
    marginBottom: 14,
  },
  group: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 18,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  rowIcon: { width: 24, alignItems: "center" },
  rowLabelWrap: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  rowSub: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  rowValue: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.muted },
  toggle: {
    width: 42,
    height: 25,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 19,
    height: 19,
    borderRadius: 999,
    marginLeft: 2,
    backgroundColor: "#FFFFFF",
  },
});
