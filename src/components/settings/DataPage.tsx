import { Alert, Linking, Share } from "react-native";
import { SettingsPage } from "./SettingsPage";
import { GroupLabel, Row } from "./kit";
import { useStore } from "../../state/store";
import { colors } from "../../design/tokens";
import { SITE_URL, WEB_APP_URL } from "../../config/env";

/**
 * Settings → Data & privacy.
 *
 * Everything about what this device and account hold, in one place: export it,
 * forget the tutorial, wipe the local copy, or delete the whole account. The
 * export is a real JSON download of the local library + taste profile — the
 * same shape the cloud holds, minus secrets (there are none on device).
 */
export function DataPage({
  onBack,
  onReplayTutorial,
  onResetData,
  signedIn,
  onDeleteAccount,
}: {
  onBack: () => void;
  onReplayTutorial: () => void;
  onResetData: () => void;
  signedIn: boolean;
  onDeleteAccount: () => void;
}) {
  const { state } = useStore();

  const exportData = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      taste: state.taste,
      prefs: state.prefs,
      saveTarget: state.saveTarget,
      autoAdvance: state.autoAdvance,
      liked: state.liked.map(({ id, title, artist, album }) => ({ id, title, artist, album })),
      discoveries: state.discoveries.map(({ id, title, artist, album }) => ({ id, title, artist, album })),
      playlists: state.playlists.map((p) => ({
        name: p.name,
        accent: p.accent,
        tracks: p.tracks.map(({ id, title, artist }) => ({ id, title, artist })),
      })),
      blockedArtists: state.neverArtists,
      buriedSongs: state.neverTracks,
    };
    try {
      await Share.share({
        message: JSON.stringify(payload, null, 2),
        title: "hooked-library.json",
      });
    } catch {
      // share sheet dismissed — nothing to do
    }
  };

  return (
    <SettingsPage
      title="Data & privacy"
      sub="What hooked keeps about you, and what you can do about it."
      onBack={onBack}
    >
      <GroupLabel>your data</GroupLabel>
      <Row
        icon="download"
        iconColor={colors.more}
        label="Export my library"
        sub="your lists and answers as JSON"
        onPress={() => void exportData()}
      />
      <Row
        icon="shield"
        label="Privacy & terms"
        sub="how your listening data is handled"
        onPress={() =>
          void Linking.openURL(`${SITE_URL}/privacy`).catch(() => {
            Alert.alert("Could not open the privacy policy", `${SITE_URL}/privacy`);
          })
        }
      />

      <GroupLabel>this device</GroupLabel>
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

      {signedIn && (
        <>
          <GroupLabel>account</GroupLabel>
          <Row
            icon="trash-2"
            iconColor={colors.never}
            label="Delete my account"
            labelColor={colors.never}
            sub="removes your account and everything saved to it, for good"
            onPress={() =>
              Alert.alert(
                "Delete your account?",
                "Your profile, swipes, library and playlists are erased. This cannot be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: onDeleteAccount },
                ],
              )
            }
          />
        </>
      )}

      <GroupLabel>elsewhere</GroupLabel>
      <Row
        icon="external-link"
        iconColor={colors.more}
        label="Website"
        sub={SITE_URL.replace(/^https?:\/\//, "")}
        onPress={() =>
          void Linking.openURL(SITE_URL).catch(() => {
            Alert.alert("Could not open website", SITE_URL);
          })
        }
      />
      <Row
        icon="globe"
        iconColor={colors.accentDefault}
        label="Web app"
        sub={WEB_APP_URL.replace(/^https?:\/\//, "")}
        onPress={() =>
          void Linking.openURL(WEB_APP_URL).catch(() => {
            Alert.alert("Could not open web app", WEB_APP_URL);
          })
        }
      />
    </SettingsPage>
  );
}
