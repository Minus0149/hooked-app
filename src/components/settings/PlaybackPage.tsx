import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { SettingsPage } from "./SettingsPage";
import { Block, GroupLabel, Row, RowValue, Segmented, StaticRow, Toggle } from "./kit";
import { useStore } from "../../state/store";
import { colors } from "../../design/tokens";
import { useDialogs } from "../Dialogs";
import { useLang } from "../../lib/lang";
import { HOOK_TIMES, hookTimeLabel } from "../../lib/hookOfDay";
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  writeNotifySettings,
} from "../../lib/hookOfDayNotify";
import { useNotifySettings } from "../../lib/useHookOfDay";
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
  const { lang, t } = useLang();
  const { confirm, notify } = useDialogs();
  const part = daypartAt();
  const hotd = useNotifySettings();
  // the switch shows off while the OS permission is gone, even if it was on
  const [permitted, setPermitted] = useState(true);
  useEffect(() => {
    void notificationPermission()
      .then((p) => setPermitted(p === "granted"))
      .catch(() => setPermitted(false));
  }, [hotd.enabled]);
  const notifyOn = hotd.enabled && permitted;

  /**
   * Android 13+ asks for POST_NOTIFICATIONS. The system prompt only ever
   * follows this in-app explanation, and only once the listener turns the
   * switch on — never at launch.
   */
  const toggleNotify = async () => {
    if (notifyOn) {
      await writeNotifySettings({ ...hotd, enabled: false });
      return;
    }
    if ((await notificationPermission()) !== "granted") {
      const ok = await confirm({
        title: t("Turn on notifications?"),
        body: t(
          "hookedcue will send one notification a day with a song picked for you. Nothing else, and you can turn it off here any time.",
        ),
        confirmLabel: t("Turn on"),
        cancelLabel: t("Not now"),
      });
      if (!ok) return;
      if (!(await requestNotificationPermission())) {
        notify(
          t(
            "Notifications are blocked for hookedcue. Allow them in your phone's settings to get your hook of the day.",
          ),
          "error",
        );
        return;
      }
    }
    setPermitted(true);
    await writeNotifySettings({ ...hotd, enabled: true });
  };

  const targetLabel =
    state.saveTarget === "liked"
      ? t("Liked Songs")
      : state.saveTarget === "discoveries"
        ? t("Discoveries")
        : (state.playlists.find((p) => `pl:${p.id}` === state.saveTarget)?.name ??
          t("Liked Songs"));

  return (
    <SettingsPage title="Playback" sub="How songs behave in the deck." onBack={onBack}>
      <Row
        glyph="▶"
        iconColor={colors.more}
        label="Auto-advance"
        sub="jump to the next song when a preview ends"
        right={<Toggle on={state.autoAdvance} />}
        onPress={() => setAutoAdvance(!state.autoAdvance)}
      />
      <StaticRow
        glyph="♪"
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
            accessibilityLabel={t("volume")}
          />
        }
      />
      <Row
        glyph="♥"
        iconColor={colors.save}
        label="Swipe down saves to"
        sub={targetLabel}
        right={<RowValue>change</RowValue>}
        onPress={onOpenSaveTarget}
      />

      <GroupLabel>{t("Hook of the day")}</GroupLabel>
      {notificationsSupported ? (
        <Row
          glyph="★"
          iconColor={colors.accentDefault}
          label="Hook of the day notification"
          sub={
            notifyOn
              ? t("Every day at {time}", { time: hookTimeLabel(hotd.hour, hotd.minute, lang) })
              : "One song a day, picked for you, at the time you choose."
          }
          right={<Toggle on={notifyOn} />}
          onPress={() => void toggleNotify()}
        />
      ) : null}
      {notificationsSupported && notifyOn ? (
        <Block label="Time">
          <Segmented<string>
            options={HOOK_TIMES.map((h) => ({
              id: `${h.hour}:${h.minute}`,
              label: hookTimeLabel(h.hour, h.minute, lang),
            }))}
            value={`${hotd.hour}:${hotd.minute}`}
            onChange={(id) => {
              const [hour, minute] = id.split(":").map(Number);
              void writeNotifySettings({ ...hotd, hour, minute });
            }}
          />
        </Block>
      ) : null}
      <Row
        glyph="☀"
        iconColor={colors.accentDefault}
        label="Hook of the day"
        sub="Show on Home"
        right={<Toggle on={hotd.showOnHome} />}
        onPress={() => void writeNotifySettings({ ...hotd, showOnHome: !hotd.showOnHome })}
      />

      <GroupLabel>time of day</GroupLabel>
      <Block
        label="Mood by the clock"
        hint={`${t(MOOD_BY_TIME.find((o) => o.id === state.prefs.moodByTime)?.copy ?? "")} — ${t("right now that's {mood}, because it's {part}", {
          mood: t(moodById(DAYPART_MOOD[part])?.label ?? "").toLowerCase(),
          part: t(DAYPART_COPY[part].label),
        })}`}
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
