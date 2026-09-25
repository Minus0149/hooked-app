import { Linking, Share } from "react-native";
import { useDialogs } from "../Dialogs";
import { SettingsPage } from "./SettingsPage";
import { Row, RowValue } from "./kit";
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
  const { confirm, notify } = useDialogs();
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

  const open = (url: string, what: string) =>
    void Linking.openURL(url).catch(() => {
      notify(`Could not open ${what} — it's at ${url}`, "error");
    });

  // one list in web's order; the only difference is the second row, which on
  // the web invites you onto the phone and here points the other way
  return (
    <SettingsPage
      title="Data & privacy"
      sub="What hooked keeps about you, and what you can do about it."
      onBack={onBack}
    >
      <Row
        icon="download"
        iconColor={colors.more}
        label="Export my library"
        sub="your lists and answers as JSON"
        right={<RowValue>save</RowValue>}
        onPress={() => void exportData()}
      />
      <Row
        icon="globe"
        iconColor={colors.save}
        label="Use it on the web"
        sub={WEB_APP_URL.replace(/^https?:\/\//, "")}
        right={<RowValue>open</RowValue>}
        onPress={() => open(WEB_APP_URL, "the web app")}
      />
      <Row
        icon="refresh-cw"
        label="Replay the swipe tutorial"
        sub="relearn the four gestures"
        onPress={onReplayTutorial}
      />
      <Row
        icon="file-text"
        label="Privacy & terms"
        sub="what we store, and how to get it deleted"
        right={<RowValue>open</RowValue>}
        onPress={() => open(`${SITE_URL}/privacy`, "the privacy policy")}
      />
      <Row
        icon="x"
        iconColor={colors.never}
        label="Reset local data"
        labelColor={colors.never}
        sub="cloud library is untouched"
        onPress={async () => {
          const ok = await confirm({
            title: "Clear this device?",
            body: "Your local library and history on this device are removed. Anything synced to your account stays.",
            confirmLabel: "Clear",
            danger: true,
          });
          if (ok) onResetData();
        }}
      />
      {signedIn && (
        <Row
          icon="x"
          iconColor={colors.never}
          label="Delete my account"
          labelColor={colors.never}
          sub="removes your library, playlists and history for good"
          onPress={async () => {
            // two steps, as on the web: this one can't be undone
            const first = await confirm({
              title: "Delete your account?",
              body: "Your account and everything in it goes. This can't be undone.",
              confirmLabel: "Continue",
              danger: true,
            });
            if (!first) return;
            const last = await confirm({
              title: "Last check",
              body: "Your library, playlists and swipe history are deleted for good.",
              confirmLabel: "Delete my account",
              danger: true,
            });
            if (last) onDeleteAccount();
          }}
        />
      )}
    </SettingsPage>
  );
}
