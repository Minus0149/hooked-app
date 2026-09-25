import { StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { SettingsPage } from "./SettingsPage";
import { Block, Segmented, StaticRow } from "./kit";
import { useStore } from "../../state/store";
import { colors } from "../../design/tokens";
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
      <StaticRow
        icon="move"
        iconColor={colors.save}
        label="Swipe distance"
        sub={s < 0.9 ? "feather-light flicks" : s > 1.1 ? "deliberate drags" : "the shipped default"}
        right={
          <Slider
            style={styles.slider}
            minimumValue={0.6}
            maximumValue={1.4}
            step={0.05}
            value={s}
            onSlidingComplete={(v) => setPrefs({ swipeSensitivity: Math.round(v * 100) / 100 })}
            minimumTrackTintColor={colors.accentDefault}
            maximumTrackTintColor={colors.line}
            thumbTintColor={colors.text}
            accessibilityLabel="swipe distance sensitivity"
          />
        }
      />
      <Block label="Haptics">
        <Segmented<HapticsLevel>
          options={HAPTICS_LEVELS}
          value={state.prefs.haptics}
          onChange={(haptics) => setPrefs({ haptics })}
        />
      </Block>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  slider: { width: 124, height: 32 },
});
