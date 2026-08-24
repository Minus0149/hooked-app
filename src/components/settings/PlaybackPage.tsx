import { Pressable, StyleSheet, Text, View } from "react-native";
import { SettingsPage } from "./SettingsPage";
import { GroupLabel, Row, Toggle } from "./kit";
import { useStore } from "../../state/store";
import { colors, fonts } from "../../design/tokens";

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
  const { state, setAutoAdvance } = useStore();

  const targetLabel =
    state.saveTarget === "liked"
      ? "Liked Songs"
      : state.saveTarget === "discoveries"
        ? "Discoveries"
        : (state.playlists.find((p) => `pl:${p.id}` === state.saveTarget)?.name ??
          "Liked Songs");

  return (
    <SettingsPage title="Playback" sub="How songs behave in the deck." onBack={onBack}>
      <GroupLabel>deck</GroupLabel>
      <Row
        icon="play"
        iconColor={colors.more}
        label="Auto-advance"
        sub="jump to the next song when a preview ends"
        right={<Toggle on={state.autoAdvance} />}
        onPress={() => setAutoAdvance(!state.autoAdvance)}
      />
      <Row
        icon={state.saveTarget === "liked" ? "heart" : "folder"}
        iconColor={colors.save}
        label="Swipe down saves to"
        sub={targetLabel}
        chevron
        onPress={onOpenSaveTarget}
      />

      <GroupLabel>volume</GroupLabel>
      <View style={styles.volCard}>
        <View style={styles.volRow}>
          <Text style={styles.volIcon}>−</Text>
          <Pressable
            style={styles.volTrack}
            onPress={(e) => {
              const w = e.nativeEvent.locationX;
              void onVolume(Math.min(Math.max(w / TRACK_WIDTH, 0), 1));
            }}
            accessibilityLabel={`volume ${Math.round(volume * 100)} percent`}
          >
            <View style={[styles.volFill, { width: `${Math.round(volume * 100)}%` as `${number}%` }]} />
          </Pressable>
          <Text style={styles.volIcon}>+</Text>
        </View>
        <Text style={styles.volValue}>{Math.round(volume * 100)}%</Text>
      </View>
    </SettingsPage>
  );
}

// the track is a fixed-width hit area; the press handler maps x → fraction
const TRACK_WIDTH = 220;

const styles = StyleSheet.create({
  volCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    gap: 10,
  },
  volRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  volIcon: { color: colors.muted, fontSize: 18, width: 14, textAlign: "center" },
  volTrack: {
    flex: 1,
    height: 26,
    justifyContent: "center",
    maxWidth: TRACK_WIDTH,
  },
  volFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentDefault,
    minWidth: 6,
  },
  volValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.muted,
    textAlign: "right",
  },
});
