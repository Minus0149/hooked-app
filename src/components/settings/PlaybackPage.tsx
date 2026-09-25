import { StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { SettingsPage } from "./SettingsPage";
import { Block, GroupLabel, Row, RowValue, Segmented, StaticRow, Toggle } from "./kit";
import { useStore } from "../../state/store";
import { colors } from "../../design/tokens";
import {
  DAYPART_COPY,
  DAYPART_MOOD,
  daypartAt,
  moodById,
  MOOD_BY_TIME,
  type MoodByTime,
} from "../../data/mood";

/**
 * Settings → Playback: what happens when a song ends and how loud it plays.
 * Volume is device-local (hardware differs) so it persists here rather than
 * syncing to the profile.
 */
export function PlaybackPage({
  onBack,
  onOpenSaveTarget,
  volume,
  onVolume,
}: {
  onBack: () => void;
  onOpenSaveTarget: () => void;
  volume: number;
  onVolume: (v: number) => void;
}) {
  const { state, setAutoAdvance, setPrefs } = useStore();
  const part = daypartAt();

  const targetLabel =
    state.saveTarget === "liked"
      ? "Liked Songs"
      : state.saveTarget === "discoveries"
        ? "Discoveries"
        : (state.playlists.find((p) => `pl:${p.id}` === state.saveTarget)?.name ??
          "Liked Songs");

  return (
    <SettingsPage title="Playback" sub="How songs behave in the deck." onBack={onBack}>
      <Row
        icon="play"
        iconColor={colors.more}
        label="Auto-advance"
        sub="jump to the next song when a preview ends"
        right={<Toggle on={state.autoAdvance} />}
        onPress={() => setAutoAdvance(!state.autoAdvance)}
      />
      <StaticRow
        icon="music"
        label="Volume"
        sub={`${Math.round(volume * 100)}%`}
        right={
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={volume}
            onValueChange={(v) => void onVolume(v)}
            minimumTrackTintColor={colors.accentDefault}
            maximumTrackTintColor={colors.line}
            thumbTintColor={colors.text}
            accessibilityLabel="volume"
          />
        }
      />
      <Row
        icon="heart"
        iconColor={colors.save}
        label="Swipe down saves to"
        sub={targetLabel}
        right={<RowValue>change</RowValue>}
        onPress={onOpenSaveTarget}
      />

      <GroupLabel>time of day</GroupLabel>
      <Block
        label="Mood by the clock"
        hint={`${MOOD_BY_TIME.find((o) => o.id === state.prefs.moodByTime)?.copy} — right now that's ${moodById(DAYPART_MOOD[part])?.label.toLowerCase()}, because it's ${DAYPART_COPY[part].label}`}
      >
        <Segmented<MoodByTime>
          options={MOOD_BY_TIME}
          value={state.prefs.moodByTime}
          onChange={(moodByTime) => setPrefs({ moodByTime })}
        />
      </Block>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  slider: { width: 124, height: 32 },
});
