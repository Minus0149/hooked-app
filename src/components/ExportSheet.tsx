import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Sheet, sheetText } from "./Sheet";
import { colors, fonts, radii } from "../design/tokens";
import { useT } from "../lib/lang";
import { playlistText, SOUNDIIZ_URL, TUNEMYMUSIC_URL, type ExportTrack } from "../lib/playlistExport";

/**
 * Take a playlist to Spotify, Apple Music or YouTube Music, same as the web's
 * ExportSheet: a plain list and a free transfer service, no Spotify sign-in.
 * On the phone the list goes out through the share sheet (which has Copy).
 */
export function ExportSheet({
  title,
  tracks,
  accent,
  onClose,
}: {
  title: string;
  tracks: ExportTrack[];
  accent: string;
  onClose: () => void;
}) {
  const t = useT();
  const text = playlistText(tracks);
  const share = () => {
    void Share.share({ message: text, title }).catch(() => undefined);
  };
  const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

  return (
    <Sheet onClose={onClose}>
      {() => (
        <View>
          <Text style={sheetText.title}>{t("Take this playlist anywhere")}</Text>
          <Text style={sheetText.sub}>
            {t(
              "Copy the list, then paste it into TuneMyMusic or Soundiiz — both are free for playlists this size and can add it to Spotify, Apple Music or YouTube Music.",
            )}
          </Text>
          <ScrollView style={styles.preview} nestedScrollEnabled>
            <Text style={styles.previewText} selectable>
              {text}
            </Text>
          </ScrollView>
          <Pressable
            style={({ pressed }) => [styles.cta, { backgroundColor: accent }, pressed && styles.pressed]}
            onPress={share}
            accessibilityRole="button"
          >
            <Feather name="share" size={14} color={colors.ink} />
            <Text style={styles.ctaText}>{t("Share list")}</Text>
          </Pressable>
          <Text style={styles.step}>{t("1. Copy the list.")}</Text>
          <Text style={styles.step}>{t("2. In TuneMyMusic choose “Free text” as the source and paste.")}</Text>
          <Text style={styles.step}>
            {t("3. Pick where it goes — Spotify, Apple Music, YouTube Music — and confirm.")}
          </Text>
          {[
            [t("Open TuneMyMusic"), TUNEMYMUSIC_URL],
            [t("Open Soundiiz"), SOUNDIIZ_URL],
          ].map(([label, url]) => (
            <Pressable
              key={url}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              onPress={() => open(url)}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>{label}</Text>
              <Feather name="external-link" size={14} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  preview: {
    maxHeight: 140,
    marginBottom: 14,
    padding: 12,
    borderRadius: radii.tile,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  previewText: { color: colors.text, fontSize: 12, lineHeight: 18, fontFamily: fonts.body },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 999,
    marginBottom: 14,
  },
  ctaText: { color: colors.ink, fontFamily: fonts.display, fontSize: 13 },
  step: { color: colors.muted, fontSize: 13, lineHeight: 20, fontFamily: fonts.body },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: radii.tile,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  linkText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyBold },
  pressed: { opacity: 0.75 },
});
