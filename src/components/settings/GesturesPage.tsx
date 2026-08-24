import { StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { SettingsPage } from "./SettingsPage";
import { GroupLabel, Segmented } from "./kit";
import { useStore } from "../../state/store";
import { colors, fonts } from "../../design/tokens";
import { HAPTICS_LEVELS, type HapticsLevel } from "../../data/prefs";

/**
 * Settings → Gestures: how sensitive the deck is and how loudly it answers.
 * Sensitivity scales the drag distance a swipe needs — the flick threshold
 * stays fixed so a decisive flick always commits.
 */
export function GesturesPage({ onBack }: { onBack: () => void }) {
  const { state, setPrefs } = useStore();
  const s = state.prefs.swipeSensitivity;

  return (
    <SettingsPage title="Gestures" sub="Tune the four swipes to your wrist." onBack={onBack}>
      <GroupLabel>swipe distance</GroupLabel>
      <View style={styles.card}>
        <Slider
          minimumValue={0.6}
          maximumValue={1.4}
          step={0.05}
          value={s}
          onSlidingComplete={(v) => setPrefs({ swipeSensitivity: Math.round(v * 100) / 100 })}
          minimumTrackTintColor={colors.accentDefault}
          maximumTrackTintColor={colors.line}
          thumbTintColor={colors.accentDefault}
          accessibilityLabel="swipe distance"
        />
        <View style={styles.hints}>
          <Text style={[styles.hint, s < 0.9 && styles.hintOn]}>feather-light</Text>
          <Text style={[styles.hint, s >= 0.9 && s <= 1.1 && styles.hintOn]}>default</Text>
          <Text style={[styles.hint, s > 1.1 && styles.hintOn]}>deliberate</Text>
        </View>
      </View>

      <GroupLabel>haptics</GroupLabel>
      <Segmented<HapticsLevel>
        options={HAPTICS_LEVELS}
        value={state.prefs.haptics}
        onChange={(haptics) => setPrefs({ haptics })}
      />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  hints: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 4 },
  hint: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted },
  hintOn: { color: colors.text },
});
