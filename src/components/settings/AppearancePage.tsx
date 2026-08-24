import { Pressable, View, StyleSheet } from "react-native";
import { SettingsPage } from "./SettingsPage";
import { GroupLabel, Segmented } from "./kit";
import { useStore } from "../../state/store";
import { colors } from "../../design/tokens";
import {
  ACCENT_SWATCHES,
  MOTION_LEVELS,
  type AccentMode,
  type MotionLevel,
} from "../../data/prefs";

/** Settings → Appearance: how the room is tinted and how much it moves. */
export function AppearancePage({ onBack }: { onBack: () => void }) {
  const { state, setPrefs } = useStore();
  const { prefs } = state;

  return (
    <SettingsPage
      title="Appearance"
      sub="How hooked looks on this screen. Changes apply instantly."
      onBack={onBack}
    >
      <GroupLabel>accent</GroupLabel>
      <Segmented<AccentMode>
        options={[
          { id: "track", label: "From each song" },
          { id: "custom", label: "Fixed colour" },
        ]}
        value={prefs.accentMode}
        onChange={(accentMode) => setPrefs({ accentMode })}
      />
      {prefs.accentMode === "custom" && (
        <View style={styles.swatches}>
          {ACCENT_SWATCHES.map((c) => {
            const on = c.toUpperCase() === prefs.accentColor.toUpperCase();
            return (
              <Pressable
                key={c}
                onPress={() => setPrefs({ accentColor: c })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`accent ${c}`}
                style={[styles.swatch, { backgroundColor: c }, on && styles.swatchOn]}
              />
            );
          })}
        </View>
      )}

      <GroupLabel>motion</GroupLabel>
      <Segmented<MotionLevel>
        options={MOTION_LEVELS}
        value={prefs.motion}
        onChange={(motion) => setPrefs({ motion })}
      />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  swatches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchOn: {
    borderColor: colors.text,
  },
});
