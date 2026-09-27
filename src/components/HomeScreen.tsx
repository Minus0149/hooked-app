import { useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../state/store";
import type { LibraryContainer, Track } from "../types";
import { colors, fonts, mixHex, radii } from "../design/tokens";
import { art } from "../lib/art";
import { Eq } from "./Eq";
import { Face } from "./faces";
import { RecapCard } from "./RecapCard";
import { inkOn } from "../lib/contrast";
import { useLang, useT } from "../lib/lang";
import { DAYPART_COPY, DAYPART_MOOD, daypartAt, moodById, moodsForHour, type MoodId } from "../data/mood";
import { DECK_LABEL, FEATURED_LABEL, SPONSORED_TAG } from "../lib/features";

/** This week's indie hook, as Home shows it (convex/featured.ts: current). */
export type FeaturedPick = { blurb: string; track: Track };
/** A sponsored deck live now (convex/sponsoredDecks.ts: live). */
export type LiveDeck = {
  id: string;
  brand: string;
  logoUrl: string | null;
  title: string;
  mood: string | null;
  genre: string | null;
  trackIds: string[];
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "up late";
  if (h < 12) return "good morning";
  if (h < 18) return "good afternoon";
  return "good evening";
}

// Two-cell artwork mosaic for a library tile; a single quiet heart when empty
function Mosaic({ tracks }: { tracks: Track[] }) {
  const cells = tracks.slice(0, 2);
  if (cells.length === 0) {
    return (
      <View style={styles.mosaic}>
        <View style={[styles.mosaicEmpty, { flex: 1 }]}>
          <Feather name="heart" size={15} color="#3C3C48" />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.mosaic}>
      {cells.map((t) => (
        <Image key={t.id} source={{ uri: art(t.artwork, 200) }} style={styles.mosaicArt} />
      ))}
      {cells.length === 1 && (
        <View style={styles.mosaicEmpty}>
          <Feather name="heart" size={15} color="#3C3C48" />
        </View>
      )}
    </View>
  );
}

/** Today's personal pick (lib/hookOfDay.ts), same card as the web's .hotd. */
function HookOfDayCard({ track, onPlay }: { track: Track; onPlay: (t: Track) => void }) {
  const { lang, t } = useLang();
  const onAccent = inkOn(track.accent);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.hotd,
        { borderColor: mixHex(track.accent, colors.line, 0.5) },
        pressed && styles.pressed,
      ]}
      onPress={() => onPlay(track)}
      accessibilityRole="button"
      accessibilityLabel={`${t("Hook of the day")}: ${track.title} — ${track.artist}`}
    >
      <Image source={{ uri: art(track.artwork, 200) }} style={styles.hotdArt} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.hotdKicker, { color: track.accent }, lang === "hi" && { letterSpacing: 0 }]}>{t("Hook of the day").toUpperCase()}</Text>
        <Text style={styles.hotdTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.hotdArtist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      <View style={[styles.hotdPlay, { backgroundColor: track.accent }]}>
        <Feather name="play" size={16} color={onAccent} />
      </View>
    </Pressable>
  );
}

function RowCard({ track, onPick }: { track: Track; onPick: (id: string) => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}
      onPress={() => onPick(track.id)}
    >
      <Image source={{ uri: art(track.artwork, 300) }} style={styles.rowArt} />
      <Text style={styles.rowTitle} numberOfLines={1}>
        {track.title}
      </Text>
      <Text style={styles.rowArtist} numberOfLines={1}>
        {track.artist}
      </Text>
    </Pressable>
  );
}

export function HomeScreen({
  accent,
  onDiscover,
  onOpenLibrary,
  onNewPlaylist,
  hookOfDay,
  onPlayHookOfDay,
  featured = null,
  onPlayFeatured,
  decks = [],
  onOpenDeck,
}: {
  accent: string;
  onDiscover: (trackId?: string) => void;
  onOpenLibrary: (container: LibraryContainer) => void;
  onNewPlaylist: () => void;
  /** today's pick, or null when hidden in Settings / nothing to pick */
  hookOfDay?: Track | null;
  onPlayHookOfDay?: (t: Track) => void;
  featured?: FeaturedPick | null;
  onPlayFeatured?: (track: Track) => void;
  decks?: LiveDeck[];
  onOpenDeck?: (deck: LiveDeck) => void;
}) {
  const { lang, t } = useLang();
  const { state, setMood } = useStore();
  const { liked, discoveries, playlists, queue, boostGenres, catalog } = state;

  /**
   * The faces, out in the open.
   *
   * The long press on a card is the fast way in and an invisible one. This row
   * is where the feature is actually discovered, and it answers the question
   * somebody on the home screen is already asking — not "what does this song
   * feel like" but "what do I want". Ordered by the hour, never filtered by it:
   * the clock is a guess about a person, and it is wrong for anyone on nights.
   */
  const hour = useMemo(() => {
    const part = daypartAt();
    return { part, moods: moodsForHour(), suggested: DAYPART_MOOD[part] };
  }, []);

  const fresh = useMemo(() => queue.slice(0, 10), [queue]);

  // parity with web: the right-swipe steer surfaces as its own row, deduped
  // by normalized title+artist and never repeating what the queue already
  // shows below it
  const becauseRows = useMemo(() => {
    const norm = (t: Track) =>
      `${t.title}·${t.artist}`.toLowerCase().replace(/\(.*?\)/g, "").trim();
    const queueIds = new Set(queue.map((t) => t.id));
    const genres =
      boostGenres.length > 0
        ? boostGenres
        : [...new Set(liked.map((t) => t.genre))].slice(0, 2);
    return genres
      .map((genre) => {
        const seen = new Set<string>();
        const tracks = catalog
          .filter(
            (t) =>
              t.genre === genre &&
              !liked.some((l) => l.id === t.id) &&
              !queueIds.has(t.id),
          )
          .filter((t) => {
            const key = norm(t);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 8);
        return { genre, tracks };
      })
      .filter((r) => r.tracks.length > 0);
  }, [boostGenres, liked, catalog, queue]);


  // All seven choices fit in one row. It used to scroll sideways, which hid
  // the mood you were in half the time and cut a face in half at the edge.
  // dark or white text, whichever reads on this accent
  const onAccent = inkOn(accent);
  const libraryEmpty = liked.length === 0 && discoveries.length === 0 && playlists.length === 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.greeting, lang === "hi" && { letterSpacing: 0 }]}>{t(greeting())}</Text>
      <Text style={styles.title}>
        {t("what's your next")} <Text style={{ color: accent }}>{t("obsession?")}</Text>
      </Text>

      {featured ? (
        // unpaid and chosen by us, so it's labelled as a pick, never "promoted" (as on web)
        <Pressable
          style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
          onPress={() => onPlayFeatured?.(featured.track)}
          accessibilityRole="button"
          accessibilityLabel={`${t(FEATURED_LABEL)}: ${featured.track.title} — ${featured.track.artist}. ${t("Play it")}.`}
        >
          <Image source={{ uri: art(featured.track.artwork, 300) }} style={styles.featuredArt} />
          <View style={styles.featuredText}>
            <Text style={styles.featuredKicker}>{t(FEATURED_LABEL).toUpperCase()}</Text>
            <Text style={styles.featuredTitle} numberOfLines={1}>{featured.track.title}</Text>
            <Text style={styles.featuredArtist} numberOfLines={1}>{featured.track.artist}</Text>
            <Text style={styles.featuredBlurb} numberOfLines={2}>{featured.blurb}</Text>
          </View>
          <View style={styles.featuredPlay}>
            <Feather name="play" size={16} color={colors.ink} />
          </View>
        </Pressable>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: accent },
          pressed && styles.pressed,
        ]}
        onPress={() => onDiscover()}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.ctaLabel, { color: onAccent }]}>{t("Start discovering")}</Text>
          <Text style={[styles.ctaSub, { color: onAccent }]}>
            {t("{n} songs queued for you", { n: queue.length })}
          </Text>
        </View>
        <Eq color={onAccent} playing />
      </Pressable>

      {hookOfDay && onPlayHookOfDay && <HookOfDayCard track={hookOfDay} onPlay={onPlayHookOfDay} />}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t("What's the mood?")}</Text>
      </View>
      <View style={styles.moodRow}>
        {hour.moods.map((mood) => {
          const isOn = state.mood === mood.id;
          const isSuggested =
            state.prefs.moodByTime !== "off" && mood.id === hour.suggested;
          return (
            <Pressable
              key={mood.id}
              style={({ pressed }) => [
                styles.moodChip,
                pressed && { transform: [{ scale: 0.94 }] },
              ]}
              onPress={() => {
                setMood(mood.id);
                onDiscover();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isOn }}
              accessibilityLabel={`${t(mood.label)} — ${t(mood.line)}`}
            >
              <View
                style={[
                  styles.moodDisc,
                  isSuggested && { borderColor: mixHex(mood.accent, colors.line, 0.58) },
                  isOn && { backgroundColor: mood.accent, borderColor: mood.accent },
                ]}
              >
                <Face
                  mood={mood.id}
                  size={26}
                  cut={isOn ? mood.accent : colors.surface}
                  animated={isOn && state.prefs.motion === "full"}
                  color={isOn ? colors.ink : isSuggested ? mood.accent : colors.muted}
                />
              </View>
              <Text
                style={[
                  styles.moodChipLabel,
                  { color: isOn ? colors.text : isSuggested ? mood.accent : colors.muted },
                ]}
                numberOfLines={1}
              >
                {t(mood.label)}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={({ pressed }) => [styles.moodChip, pressed && { transform: [{ scale: 0.94 }] }]}
          onPress={() => {
            setMood(null);
            onDiscover();
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: state.mood === null }}
          accessibilityLabel={t("Any — no mood on the deck")}
        >
          <View
            style={[
              styles.moodDisc,
              state.mood === null && { backgroundColor: colors.text, borderColor: colors.text },
            ]}
          >
            <Text style={[styles.moodAny, state.mood === null && { color: colors.ink }]}>∞</Text>
          </View>
          <Text
            style={[styles.moodChipLabel, { color: state.mood === null ? colors.text : colors.muted }]}
          >
            {t("Any")}
          </Text>
        </Pressable>
      </View>
      {state.prefs.moodByTime !== "off" ? (
        <Text style={styles.moodNudge}>{t(DAYPART_COPY[hour.part].nudge)}</Text>
      ) : null}
      {decks.map((d) => {
        const mood = d.mood ? moodById(d.mood as MoodId) : null;
        const tint = mood?.accent ?? accent;
        return (
          // a brand paid for this deck: it says so, on the card itself (ASCI), as on web
          <Pressable
            key={d.id}
            style={({ pressed }) => [
              styles.deck,
              { borderColor: mixHex(tint, colors.line, 0.55), backgroundColor: mixHex(tint, colors.surface, 0.12) },
              pressed && styles.pressed,
            ]}
            onPress={() => onOpenDeck?.(d)}
            accessibilityRole="button"
            accessibilityLabel={`${t(DECK_LABEL, { title: d.title, brand: d.brand })}. ${t(SPONSORED_TAG)}.`}
          >
            {d.logoUrl ? (
              <Image source={{ uri: d.logoUrl }} style={styles.deckLogo} />
            ) : mood ? (
              <View style={styles.moodDisc}>
                <Face mood={mood.id} size={26} cut={colors.surface} color={mood.accent} />
              </View>
            ) : null}
            <View style={styles.deckText}>
              <Text style={styles.deckTitle} numberOfLines={2}>{t(DECK_LABEL, { title: d.title, brand: d.brand })}</Text>
              <Text style={styles.deckTag}>{t(SPONSORED_TAG).toUpperCase()}</Text>
            </View>
          </Pressable>
        );
      })}

      <RecapCard />

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t("Your library")}</Text>
      </View>
      {libraryEmpty ? (
        // one invitation, not two empty boxes pretending to be a library
        <Pressable
          style={({ pressed }) => [styles.emptyLibrary, pressed && styles.pressed]}
          onPress={onNewPlaylist}
          accessibilityRole="button"
        >
          <View style={styles.emptyIcon}>
            <Feather name="heart" size={17} color={colors.save} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>{t("Nothing saved yet")}</Text>
            <Text style={styles.emptySub}>
              {t("Swipe a song down to keep it. Tap here, or hold +, to start a playlist.")}
            </Text>
          </View>
        </Pressable>
      ) : (
      <View style={styles.tiles}>
        <Pressable
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          onPress={() => onOpenLibrary("liked")}
        >
          <Mosaic tracks={liked} />
          <Text style={styles.tileName}>{t("Liked Songs")}</Text>
          <Text style={styles.tileSub}>
            {t(liked.length === 1 ? "{n} song" : "{n} songs", { n: liked.length })}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          onPress={() => onOpenLibrary("discoveries")}
        >
          <Mosaic tracks={discoveries} />
          <Text style={styles.tileName}>{t("Discoveries")}</Text>
          <Text style={styles.tileSub}>
            {t(discoveries.length === 1 ? "{n} song" : "{n} songs", { n: discoveries.length })}
          </Text>
        </Pressable>
        {playlists.map((p) => (
          <Pressable
            key={p.id}
            style={({ pressed }) => [
              styles.tile,
              { borderColor: mixHex(p.accent, colors.line, 0.45) },
              pressed && styles.pressed,
            ]}
            onPress={() => onOpenLibrary(`pl:${p.id}`)}
          >
            <Mosaic tracks={p.tracks} />
            <Text style={styles.tileName} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.tileSub}>
              {t(p.tracks.length === 1 ? "{n} song" : "{n} songs", { n: p.tracks.length })}
            </Text>
          </Pressable>
        ))}
      </View>
      )}

      {becauseRows.map((row) => (
        <View key={row.genre} style={styles.becauseWrap}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>
              {t("Because you wanted more")}{" "}
              <Text style={{ color: accent }}>{row.genre}</Text>
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.rowScroll}
            contentContainerStyle={styles.rowScrollContent}
          >
            {row.tracks.map((tr) => (
              <RowCard key={tr.id} track={tr} onPick={(id) => onDiscover(id)} />
            ))}
          </ScrollView>
        </View>
      ))}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t("Fresh for you")}</Text>
        <Text style={styles.sectionCount}>{t("tap to play")}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowScroll}
        contentContainerStyle={styles.rowScrollContent}
      >
        {fresh.map((tr) => (
          <RowCard key={tr.id} track={tr} onPick={(id) => onDiscover(id)} />
        ))}
      </ScrollView>

      {liked.length > 0 && (
        <>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t("Recently saved")}</Text>
          </View>
          {liked.slice(0, 5).map((tr) => (
            <Pressable
              key={tr.id}
              style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
              onPress={() => onDiscover(tr.id)}
            >
              <Image source={{ uri: art(tr.artwork, 100) }} style={styles.listArt} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {tr.title}
                </Text>
                <Text style={styles.listArtist} numberOfLines={1}>
                  {tr.artist}
                </Text>
              </View>
              <Feather name="heart" size={14} color={colors.save} />
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hotd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    marginBottom: 18,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  hotdArt: { width: 64, height: 64, borderRadius: 14 },
  hotdKicker: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 1.4 },
  hotdTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.text, marginTop: 2 },
  hotdArtist: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  hotdPlay: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  // indie hook of the week (src/lib/features.ts)
  featured: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: mixHex(colors.save, colors.surface, 0.14),
  },
  featuredArt: { width: 72, height: 72, borderRadius: 14 },
  featuredText: { flex: 1, minWidth: 0, gap: 2 },
  featuredKicker: { color: colors.save, fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 1.5 },
  featuredTitle: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 16 },
  featuredArtist: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  featuredBlurb: { color: colors.text, opacity: 0.85, fontFamily: fonts.body, fontSize: 12.5 },
  featuredPlay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
  },
  // sponsored mood decks
  deck: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    // the mood nudge above already leaves 28; sit close under it and leave a
    // full section gap before "Your library", as on the web
    marginTop: -12,
    marginBottom: 28,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  deckLogo: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#fff" },
  deckText: { flex: 1, minWidth: 0, gap: 3 },
  deckTitle: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 14 },
  deckTag: {
    alignSelf: "flex-start",
    color: colors.muted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  scroll: { flex: 1 },
  // extra bottom padding so content never scrolls under the protruding nav FAB
  content: { paddingHorizontal: 20, paddingBottom: 38 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  greeting: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    letterSpacing: 2.3,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 10,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 27,
    letterSpacing: -0.8,
    lineHeight: 32,
    color: colors.text,
    marginBottom: 20,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 24,
    padding: 22,
    marginBottom: 26,
  },
  ctaLabel: { fontFamily: fonts.displayBold, fontSize: 18, color: "#FFFFFF" },
  ctaSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    opacity: 0.72,
    marginTop: 4,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    letterSpacing: -0.1,
    color: colors.text,
  },
  sectionCount: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.muted },
  sectionAction: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  moodRow: { flexDirection: "row", gap: 2, paddingBottom: 2 },
  // circles, matching the ring: the face on the card, on the ring and here are
  // the same round object at three sizes
  moodChip: { flex: 1, minWidth: 0, alignItems: "center", gap: 7, paddingTop: 2, paddingBottom: 4 },
  moodDisc: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  moodChipLabel: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  moodAny: { fontFamily: fonts.body, fontSize: 19, lineHeight: 22, color: colors.muted },
  emptyLibrary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    marginBottom: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,229,160,0.12)",
  },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.text, marginBottom: 3 },
  emptySub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  moodNudge: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 10,
    marginBottom: 28,
  },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  becauseWrap: { marginBottom: 4 },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    maxWidth: "48.5%",
    borderRadius: radii.tile,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  mosaic: {
    flexDirection: "row",
    gap: 3,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface2,
    aspectRatio: 2,
    marginBottom: 12,
  },
  mosaicArt: { flex: 1, height: "100%" },
  mosaicEmpty: {
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  tileName: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.text },
  tileSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 3 },
  rowScroll: { marginHorizontal: -20, marginBottom: 28 },
  rowScrollContent: { paddingHorizontal: 20, gap: 12 },
  rowCard: {
    // width + flexShrink:0 — without an explicit cap a long nowrap artist
    // name stretches the card past 124 and breaks the row's rhythm
    width: 124,
    flexShrink: 0,
  },
  rowArt: {
    width: 124,
    height: 124,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
  rowArtist: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  listArt: { width: 46, height: 46, borderRadius: 10 },
  listTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  listArtist: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
});

