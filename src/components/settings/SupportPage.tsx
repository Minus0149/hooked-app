import { Pressable, StyleSheet, Text, View } from "react-native";
import { anyApi } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { SettingsPage } from "./SettingsPage";
import { Block, FieldLabel, Segmented } from "./kit";
import { useDialogs } from "../Dialogs";
import { useStore } from "../../state/store";
import { colors, fonts } from "../../design/tokens";
import { AD_FREQUENCIES, AD_UNITS, AD_UNIT_BOUNDS } from "../../data/prefs";

const PACE_DEFAULTS: Record<string, number> = { swipes: 12, minutes: 30, hours: 2, day: 1 };

/**
 * Settings → Support hooked: the house-ads choice, on its own page as on the
 * web (it used to be a card at the foot of the Settings hub). Same wording,
 * same order: the explanation, on/off, how often, and the listener's own pace.
 */
export function SupportPage({ onBack }: { onBack: () => void }) {
  const { confirm } = useDialogs();
  const { state, setPrefs } = useStore();
  const optedOut = state.prefs.adsOptOut;
  const setPrefsMutation = useMutation(anyApi.library.setPrefs);
  const adsConfig = useQuery(anyApi.ads.getConfig) as
    | { enabled: boolean; everyNSwipes: number; maxPerDay: number }
    | null
    | undefined;

  const syncOptOut = (adsOptOut: boolean) => {
    setPrefs({ adsOptOut });
    void setPrefsMutation({
      motion: state.prefs.motion,
      haptics: state.prefs.haptics,
      accentMode: state.prefs.accentMode,
      accentColor: state.prefs.accentColor,
      swipeSensitivity: state.prefs.swipeSensitivity,
      adsOptOut,
    }).catch(() => undefined);
  };

  // the ask when someone turns ads off — honest, not guilt-trippy (web's copy)
  const askBeforeOff = async () => {
    const turnOff = await confirm({
      title: "Before you go…",
      body:
        "hooked has no investors and no label money. Those few quiet cards between songs are what pay for the servers, the licences and the hours this takes. Turning them off won't cost you anything — but if a few hundred people do, this deck goes quiet with them.\n\nWhatever you choose, the music keeps playing. That's a promise.",
      cancelLabel: "Keep them on — I get it",
      confirmLabel: "Turn them off anyway",
      danger: true,
    });
    syncOptOut(turnOff);
  };

  const cadence = state.prefs.adCadence;
  const step = (dir: -1 | 1) => {
    if (!cadence) return;
    const b = AD_UNIT_BOUNDS[cadence.unit];
    const value = dir < 0 ? Math.max(b.min, cadence.value - b.step) : Math.min(b.max, cadence.value + b.step);
    setPrefs({ adCadence: { unit: cadence.unit, value } });
  };

  return (
    <SettingsPage
      title="Support hooked"
      sub="The cards that keep the deck independent."
      onBack={onBack}
    >
      <Block label="House ads">
        <Text style={styles.explain}>
          {optedOut
            ? "You've turned these off. Fair enough — they'll stay off until you change your mind."
            : adsConfig?.enabled
              ? `A small sponsored card every ~${adsConfig.everyNSwipes} swipes, at most ${adsConfig.maxPerDay} a day. Music never stops for one.`
              : "No cards are being shown right now."}
        </Text>
        <Segmented<"on" | "off">
          options={[
            { id: "on", label: "On — keep hooked independent" },
            { id: "off", label: "Off" },
          ]}
          value={optedOut ? "off" : "on"}
          onChange={(v) => {
            if (v === "on") syncOptOut(false);
            else if (!optedOut) void askBeforeOff();
          }}
        />

        {!optedOut && (
          <>
            <FieldLabel>How often</FieldLabel>
            <Segmented
              options={AD_FREQUENCIES}
              value={cadence === null ? state.prefs.adFrequency : ("custom" as never)}
              onChange={(adFrequency) => setPrefs({ adFrequency: adFrequency as never, adCadence: null })}
            />

            {/* the listener's exact dial: pick the unit, set the number */}
            <Block
              label="Your own pace"
              style={styles.inner}
              hint="pick a unit, set the number — the daily and weekly ceilings set by hooked always hold, and music never stops for a card"
            >
              <Segmented
                options={AD_UNITS}
                value={cadence?.unit ?? ("none" as never)}
                onChange={(unit) =>
                  setPrefs({ adCadence: { unit: unit as never, value: PACE_DEFAULTS[unit as string] ?? 12 } })
                }
              />
              {cadence && (
                <View style={styles.stepper}>
                  <Pressable style={styles.stepBtn} onPress={() => step(-1)} accessibilityLabel="less frequent">
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepValue}>
                    {cadence.unit === "day" ? (
                      <>
                        <Text style={styles.stepStrong}>{cadence.value}</Text> card{cadence.value > 1 ? "s" : ""} a day
                      </>
                    ) : (
                      <>
                        a card every <Text style={styles.stepStrong}>{cadence.value}</Text> {cadence.unit}
                      </>
                    )}
                  </Text>
                  <Pressable style={styles.stepBtn} onPress={() => step(1)} accessibilityLabel="more frequent">
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
              )}
            </Block>
          </>
        )}
      </Block>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  explain: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.muted },
  inner: { marginTop: 10, marginBottom: 0, backgroundColor: colors.bg },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  stepBtn: {
    minWidth: 42,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    alignItems: "center",
  },
  stepBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.text },
  stepValue: { fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  stepStrong: { fontFamily: fonts.bodyBold, fontSize: 16 },
});
