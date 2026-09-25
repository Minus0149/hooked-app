import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SettingsPage } from "./SettingsPage";
import { FieldLabel, GroupLabel, Hint, Row, RowValue, Segmented, Toggle } from "./kit";
import { ReplayRules } from "../ReplayRules";
import { useStore } from "../../state/store";
import { colors, fonts } from "../../design/tokens";
import {
  ADVENTURE,
  availableTasteOptions,
  type Adventure,
  type TastePrefs,
} from "../../data/taste";

/**
 * Settings → Sound & taste.
 *
 * The onboarding answers used to be write-once: changing them meant replaying
 * the whole tutorial. They live here now, next to everything else that shapes
 * what the deck deals — including the list of blocked artists, which before
 * this page existed could never be lifted at all (the empty-deck copy even
 * claimed you could).
 */
export function SoundPage({
  onBack,
  onReplay,
  onUnbury,
  onUnblockArtist,
}: {
  onBack: () => void;
  onReplay: (container: string, allow: boolean) => void;
  onUnbury: (trackId: string) => void;
  onUnblockArtist: (artist: string) => void;
}) {
  const { state, setTaste, setPrefs } = useStore();
  const [showBlocked, setShowBlocked] = useState(false);
  const options = useMemo(
    () => availableTasteOptions(state.catalog),
    [state.catalog],
  );
  const taste = state.taste;

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const chip = (on: boolean, label: string, onPress: () => void, accent?: string) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={[styles.chip, on && { backgroundColor: accent ?? colors.accentDefault, borderColor: accent ?? colors.accentDefault }]}
    >
      <Text style={[styles.chipText, on && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );

  return (
    <SettingsPage
      title="Sound & taste"
      sub="The deck tilts toward these answers without ever walling anything out."
      onBack={onBack}
    >
      <FieldLabel>Languages</FieldLabel>
      <View style={styles.chipWrap}>
        {options.languages.map((l) =>
          chip(taste.languages.includes(l.id), l.label, () =>
            setTaste({ ...taste, languages: toggle(taste.languages, l.id) } satisfies TastePrefs),
          ),
        )}
      </View>

      <FieldLabel>Genres</FieldLabel>
      <View style={styles.chipWrap}>
        {options.genres.map((g) =>
          chip(taste.genres.includes(g.id), g.label, () =>
            setTaste({ ...taste, genres: toggle(taste.genres, g.id) } satisfies TastePrefs),
          ),
        )}
      </View>

      <FieldLabel>Adventure</FieldLabel>
      <Segmented<Adventure>
        options={ADVENTURE.map((a) => ({ id: a.id, label: a.label }))}
        value={taste.adventure}
        onChange={(adventure) => setTaste({ ...taste, adventure } satisfies TastePrefs)}
      />

      <GroupLabel>discovery rules</GroupLabel>
      <Hint>
        The deck's default strictness. Playlists can relax these for themselves,
        per playlist.
      </Hint>
      {(
        [
          ["allowRepeats", "Allow songs to reappear", "saved songs can come back around", "refresh-cw", colors.more],
          ["includeBuried", "Deal buried songs", "songs you swiped left can return", "x", colors.never],
          ["includeBlockedArtists", "Deal blocked artists", "artists you blocked can return", "x", colors.never],
        ] as const
      ).map(([key, label, sub, icon, iconColor]) => (
        <Row
          key={key}
          icon={icon}
          iconColor={iconColor}
          label={label}
          sub={sub}
          right={<Toggle on={state.prefs[key]} />}
          onPress={() => setPrefs({ [key]: !state.prefs[key] })}
        />
      ))}

      {/* ReplayRules carries its own "what comes back" heading */}
      <ReplayRules onReplay={onReplay} onUnbury={onUnbury} />

      {state.neverArtists.length > 0 && (
        <>
          <GroupLabel>blocked artists</GroupLabel>
          <Row
            icon="x"
            iconColor={colors.never}
            label={`Blocked artists (${state.neverArtists.length})`}
            sub="their songs never reach your deck"
            right={<RowValue>{showBlocked ? "hide" : "unblock"}</RowValue>}
            onPress={() => setShowBlocked((v) => !v)}
          />
          {showBlocked &&
            state.neverArtists.slice(0, 50).map((a) => (
              <Row
                key={a}
                icon="more-horizontal"
                iconColor={colors.muted}
                label={a}
                sub="blocked"
                right={<RowValue color={colors.more}>unblock</RowValue>}
                onPress={() => onUnblockArtist(a)}
              />
            ))}
        </>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
});

