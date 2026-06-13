import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Dimensions,
  Image,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import {
  Gesture,
  GestureDetector,
  type PanGesture,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { SaveTarget, SwipeDir, Track } from "../types";
import { colors, fonts, gesture, radii } from "../design/tokens";
import { DiscFX, type SaveFxData, type SaveRelease } from "./DiscFX";
import { Eq } from "./Eq";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// a save only locks the deck briefly — the DiscFX overlay plays above while
// the next card is already swipeable
const SAVE_LOCK_MS = 200;

const STAMP: Record<SwipeDir, { label: string; color: string }> = {
  up: { label: "SKIP ↑", color: "#FFFFFF" },
  down: { label: "♥ SAVED", color: colors.save },
  right: { label: "✦ MORE LIKE THIS", color: colors.more },
  left: { label: "✕ NEVER", color: colors.never },
};

export function resolveDirWorklet(
  tx: number,
  ty: number,
  vx: number,
  vy: number,
): SwipeDir | null {
  "worklet";
  const absX = Math.abs(tx);
  const absY = Math.abs(ty);
  const byDistance = Math.max(absX, absY) > gesture.commitDistance;
  const byFlick = Math.max(Math.abs(vx), Math.abs(vy)) > gesture.commitVelocity;
  if (!byDistance && !byFlick) return null;
  if (absX > absY * gesture.axisDominance) return tx > 0 ? "right" : "left";
  if (absY > absX * gesture.axisDominance) return ty > 0 ? "down" : "up";
  return null;
}

/**
 * One card, any depth. Its pose is decided ON THE UI THREAD from the `topId`
 * shared value: a card renders the drag transform ONLY while it IS the top
 * card. Promotion (topId + x/y reset) flushes in a single animation frame,
 * so no card can ever paint with another card's pose — this is what finally
 * kills the "old image flashes at center after a swipe" frame race.
 */
const DeckCard = memo(function DeckCard({
  track,
  depth,
  x,
  y,
  topId,
  cardGesture,
  chrome,
}: {
  track: Track;
  depth: number; // 0 = on deck
  x: SharedValue<number>;
  y: SharedValue<number>;
  topId: SharedValue<string>;
  cardGesture: PanGesture | null; // null below the top card
  chrome: ReactNode; // stamps/meta/scrubber — only the top card gets these
}) {
  // every non-top card gets its OWN disabled gesture: sharing one instance
  // across multiple GestureDetectors corrupts RNGH's handler bookkeeping
  // (symptom: the top card's pan stops responding)
  const inert = useMemo(() => Gesture.Pan().enabled(false), []);
  const pose = useAnimatedStyle(() => {
    if (topId.value === track.id) {
      return {
        opacity: 1,
        transform: [
          { translateX: x.value },
          { translateY: y.value },
          { rotate: `${interpolate(x.value, [-220, 220], [-13, 13])}deg` },
          { scale: 1 },
        ],
      };
    }
    if (depth >= 2) {
      return {
        opacity: 0.3,
        transform: [
          { translateX: 0 },
          { translateY: 26 },
          { rotate: "0deg" },
          { scale: 0.88 },
        ],
      };
    }
    return {
      opacity: 0.55,
      transform: [
        { translateX: 0 },
        { translateY: 14 },
        { rotate: "0deg" },
        { scale: 0.94 },
      ],
    };
  }, [track.id, depth]);

  return (
    <GestureDetector gesture={cardGesture ?? inert}>
      <Animated.View style={[styles.card, { shadowColor: track.accent }, pose]}>
        <Image source={{ uri: track.artwork }} style={styles.art} />
        <CardScrim />
        {chrome}
      </Animated.View>
    </GestureDetector>
  );
});

// Top + bottom gradient scrims, matching web's .card-scrim
function CardScrim() {
  return (
    <>
      <LinearGradient
        colors={[colors.scrimTop, colors.scrimFade]}
        style={styles.scrimTopGrad}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[colors.scrimFade, colors.scrimBottom]}
        style={styles.scrimBottomGrad}
        pointerEvents="none"
      />
    </>
  );
}

function ActionButton({
  icon,
  color,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
      hitSlop={6}
    >
      <Feather name={icon} size={21} color={color} />
    </Pressable>
  );
}

export function SwipeDeck({
  tracks,
  backToken,
  progress,
  remaining,
  playing,
  saveTarget,
  fullSongOpen,
  onToggle,
  onSeek,
  onOpenFullSong,
  onSwipeStart,
  onSwipe,
}: {
  tracks: Track[]; // [onDeck, next, nextNext]
  backToken: number; // bumped by ↩ — cancels any in-flight save FX
  progress: number; // 0..1 of the preview
  remaining: number; // seconds left in the preview
  playing: boolean;
  saveTarget: SaveTarget;
  fullSongOpen: boolean;
  onToggle: () => void;
  onSeek: (fraction: number) => void;
  onOpenFullSong: () => void;
  onSwipeStart: () => void; // gesture committed — arm interaction guards NOW
  onSwipe: (dir: SwipeDir) => void;
}) {
  const [onDeck, next, nextNext] = tracks;

  // warm the image cache for upcoming cards — keyed on the actual ids, NOT
  // the array identity (which changes on every 250ms progress re-render)
  const nextId = next?.id;
  const nextNextId = nextNext?.id;
  useEffect(() => {
    for (const t of [next, nextNext]) {
      if (t?.artwork) void Image.prefetch(t.artwork).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextId, nextNextId]);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const locked = useSharedValue(false);

  // save FX: vinyl morph overlays — a LIST, so spamming ♥ doesn't unmount
  // the previous disc mid-air
  const [saveFxList, setSaveFxList] = useState<SaveFxData[]>([]);
  const saveCount = useRef(0);

  // ↩ cancels the save animations: the saves they depict were just reverted,
  // and the song is back on deck — letting a disc finish would show it twice
  useEffect(() => {
    if (backToken > 0) setSaveFxList([]);
  }, [backToken]);

  // gesture FX
  const ringScale = useSharedValue(0.7);
  const ringOpacity = useSharedValue(0);
  const vignetteOpacity = useSharedValue(0);

  const deckW = useRef(0);
  const deckH = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // commit advances the queue ONLY. Never reset x/y here: the old card is
  // still mounted as top until React re-renders, and a reset reaches the
  // native view first — snapping the OLD image back to center for a frame.
  const commit = useCallback(
    (dir: SwipeDir) => {
      onSwipe(dir);
    },
    [onSwipe],
  );

  // atomic promotion: when the on-deck track changes, hand the "top" role to
  // the new card and reset the pose in the SAME animation-frame flush
  const topId = useSharedValue(onDeck?.id ?? "");
  useLayoutEffect(() => {
    topId.value = onDeck?.id ?? "";
    x.value = 0;
    y.value = 0;
    locked.value = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDeck?.id]);

  const flashRing = useCallback(() => {
    ringScale.value = 0.7;
    ringScale.value = withTiming(1.25, { duration: 340, easing: Easing.out(Easing.quad) });
    ringOpacity.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(0, { duration: 250 }),
    );
  }, []);

  const flashVignette = useCallback(() => {
    vignetteOpacity.value = withSequence(
      withTiming(0.35, { duration: 110 }),
      withTiming(0, { duration: 240 }),
    );
  }, []);

  const handleDir = useCallback(
    (dir: SwipeDir, release?: SaveRelease) => {
      if (!onDeck || locked.value) return;
      locked.value = true;
      onSwipeStart(); // the gesture is committed — guards arm from this moment
      if (dir === "down") {
        // the DiscFX overlay takes over from the exact release pose — commit
        // fires NOW so the next card + audio start while the disc FX plays
        saveCount.current += 1;
        setSaveFxList((list) => [
          ...list.slice(-2), // at most 3 discs in flight
          {
            key: Date.now(),
            track: onDeck,
            from: release ?? { x: 0, y: 0, vx: 0, vy: 650 }, // ♥ button: drop from center
            mode: saveCount.current % 5 === 0 ? "cinematic" : "fast",
          },
        ]);
        onSwipe("down"); // pose reset happens in the promotion layout effect
        timers.current.push(
          setTimeout(() => {
            locked.value = false;
          }, SAVE_LOCK_MS),
        );
        return;
      }
      if (dir === "right") flashRing();
      if (dir === "left") flashVignette();
      const fly = 1.2;
      const tx = dir === "right" ? SCREEN_W * fly : dir === "left" ? -SCREEN_W * fly : 0;
      const ty = dir === "up" ? -SCREEN_H * fly : 0;
      x.value = withTiming(tx, { duration: 260 });
      y.value = withTiming(ty, { duration: 260 }, (finished) => {
        if (finished) runOnJS(commit)(dir);
      });
    },
    [onDeck, onSwipe, onSwipeStart, flashRing, flashVignette, commit],
  );

  // ---- scrubber: its own pan that beats the card pan, so dragging the
  // bottom 22px seeks instead of swiping ----
  const barW = useSharedValue(1);
  const scrubFrac = useSharedValue(-1); // -1 = not scrubbing → show `progress`

  const seekTo = useCallback(
    (f: number) => onSeek(Math.min(Math.max(f, 0), 1)),
    [onSeek],
  );

  const scrubPan = Gesture.Pan()
    .onBegin((e) => {
      scrubFrac.value = Math.min(Math.max(e.x / barW.value, 0), 1);
    })
    .onUpdate((e) => {
      const f = Math.min(Math.max(e.x / barW.value, 0), 1);
      scrubFrac.value = f;
      runOnJS(seekTo)(f);
    })
    .onFinalize(() => {
      if (scrubFrac.value >= 0) runOnJS(seekTo)(scrubFrac.value);
      // hold the scrubbed position briefly so the fill doesn't snap back to a
      // stale status before the player reports the new position
      scrubFrac.value = withDelay(400, withTiming(-1, { duration: 0 }));
    });

  const fillStyle = useAnimatedStyle(() => {
    const f = scrubFrac.value >= 0 ? scrubFrac.value : progress;
    return { width: Math.min(Math.max(f, 0), 1) * barW.value };
  }, [progress]);
  const knobStyle = useAnimatedStyle(() => {
    const f = scrubFrac.value >= 0 ? scrubFrac.value : progress;
    return {
      left: Math.min(Math.max(f, 0), 1) * barW.value - 4,
      opacity: scrubFrac.value >= 0 ? 1 : 0,
    };
  }, [progress]);

  const pan = Gesture.Pan()
    .requireExternalGestureToFail(scrubPan)
    .onUpdate((e) => {
      if (locked.value) return;
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd((e) => {
      if (locked.value) return;
      const dir = resolveDirWorklet(
        e.translationX,
        e.translationY,
        e.velocityX,
        e.velocityY,
      );
      if (dir === null) {
        x.value = withSpring(0, { stiffness: 320, damping: 26 });
        y.value = withSpring(0, { stiffness: 320, damping: 26 });
        return;
      }
      // hand the exact release pose to JS so a save inherits the momentum
      runOnJS(handleDir)(dir, {
        x: e.translationX,
        y: e.translationY,
        vx: e.velocityX,
        vy: e.velocityY,
      });
    });

  const upStamp = useAnimatedStyle(() => ({
    opacity: interpolate(-y.value, [36, 110], [0, 1]),
  }));
  const downStamp = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [36, 110], [0, 1]),
  }));
  const rightStamp = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [36, 110], [0, 1]),
  }));
  const leftStamp = useAnimatedStyle(() => ({
    opacity: interpolate(-x.value, [36, 110], [0, 1]),
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const vignetteStyle = useAnimatedStyle(() => ({
    opacity: vignetteOpacity.value,
  }));

  const onDeckLayout = (e: LayoutChangeEvent) => {
    deckW.current = e.nativeEvent.layout.width;
    deckH.current = e.nativeEvent.layout.height;
  };

  // stamps/meta/scrubber — built for the on-deck track only and handed to
  // whichever DeckCard currently holds the top role
  const chrome = onDeck ? (
    <>
      <Animated.View
        style={[styles.stamp, styles.stampUp, { borderColor: STAMP.up.color }, upStamp]}
      >
        <Text style={[styles.stampText, { color: STAMP.up.color }]}>
          {STAMP.up.label}
        </Text>
      </Animated.View>
      <Animated.View
        style={[styles.stamp, styles.stampDown, { borderColor: STAMP.down.color }, downStamp]}
      >
        <Text style={[styles.stampText, { color: STAMP.down.color }]}>
          {STAMP.down.label}
        </Text>
      </Animated.View>
      <Animated.View
        style={[styles.stamp, styles.stampRight, { borderColor: STAMP.right.color }, rightStamp]}
      >
        <Text style={[styles.stampText, { color: STAMP.right.color }]}>
          {STAMP.right.label}
        </Text>
      </Animated.View>
      <Animated.View
        style={[styles.stamp, styles.stampLeft, { borderColor: STAMP.left.color }, leftStamp]}
      >
        <Text style={[styles.stampText, { color: STAMP.left.color }]}>
          {STAMP.left.label}
        </Text>
      </Animated.View>

      <View style={styles.meta}>
        <View style={[styles.genre, { backgroundColor: onDeck.accent }]}>
          <Text style={styles.genreText}>{onDeck.genre.toUpperCase()}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {onDeck.title}
        </Text>
        <View style={styles.artistRow}>
          <Eq color={onDeck.accent} playing={playing} />
          <Text style={styles.artist} numberOfLines={1}>
            {onDeck.artist}
          </Text>
        </View>
      </View>
      <GestureDetector gesture={scrubPan}>
        <Animated.View
          style={styles.scrub}
          onLayout={(e) => {
            barW.value = e.nativeEvent.layout.width || 1;
          }}
        >
          <View style={styles.scrubTrack} />
          <Animated.View
            style={[styles.scrubFill, { backgroundColor: onDeck.accent }, fillStyle]}
          />
          <Animated.View
            style={[
              styles.scrubKnob,
              { backgroundColor: onDeck.accent, shadowColor: onDeck.accent },
              knobStyle,
            ]}
          />
        </Animated.View>
      </GestureDetector>
    </>
  ) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.deck} onLayout={onDeckLayout}>
        {/* deepest card paints first; keys keep identity across promotions */}
        {tracks
          .slice(0, 3)
          .map((t, i) => ({ t, i }))
          .reverse()
          .map(({ t, i }) => (
            <DeckCard
              key={t.id}
              track={t}
              depth={i}
              x={x}
              y={y}
              topId={topId}
              cardGesture={i === 0 ? pan : null}
              chrome={i === 0 ? chrome : null}
            />
          ))}

        {!onDeck && (
          <View style={styles.emptyDeck}>
            <Feather name="slash" size={26} color={colors.muted} />
            <Text style={styles.emptyTitle}>nothing left to deal</Text>
            <Text style={styles.emptyCopy}>
              You've ruled out every artist in the catalog. Unblock some in
              Settings, or remove songs from your library to hear them again.
            </Text>
          </View>
        )}

        {/* the preview is almost over — offer the full song */}
        {onDeck && remaining <= 5 && remaining > 0 && !fullSongOpen && (
          <Animated.View
            key={`chip-${onDeck.id}`}
            entering={FadeInDown.springify().stiffness(420).damping(26)}
            exiting={FadeOutDown.duration(160)}
            style={styles.chipWrap}
          >
            <Pressable
              onPress={onOpenFullSong}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: onDeck.accent, shadowColor: onDeck.accent },
                pressed && { transform: [{ scale: 0.94 }] },
              ]}
            >
              <Text style={styles.chipText}>keep listening ▸</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* left-swipe: quick red vignette flash */}
        <Animated.View pointerEvents="none" style={[styles.vignette, vignetteStyle]} />
        {/* right-swipe: warm accent ring flash at center-right */}
        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />

        {/* save FX: the released card morphs into a spinning vinyl disc and
            slides into an album sleeve, above the already-live next card */}
        {saveFxList.map((saveFx) => (
          <DiscFX
            key={saveFx.key}
            data={saveFx}
            deckW={deckW.current || SCREEN_W - 40}
            deckH={deckH.current || SCREEN_H * 0.6}
            sticker={saveTarget === "liked" ? "♥" : "✓"}
            onDone={() =>
              setSaveFxList((list) => list.filter((f) => f.key !== saveFx.key))
            }
          />
        ))}
      </View>

      <View style={styles.actions}>
        <ActionButton icon="x" color={colors.never} onPress={() => handleDir("left")} />
        <ActionButton icon="arrow-up" color={colors.text} onPress={() => handleDir("up")} />
        <Pressable
          onPress={onToggle}
          onLongPress={onOpenFullSong}
          delayLongPress={480}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.actionPressed]}
          hitSlop={6}
        >
          <Feather
            name={playing ? "pause" : "play"}
            size={26}
            color={colors.ink}
            // optical centering: the play triangle leans left inside its glyph box
            style={playing ? undefined : { marginLeft: 3 }}
          />
        </Pressable>
        <ActionButton icon="heart" color={colors.save} onPress={() => handleDir("down")} />
        <ActionButton icon="zap" color={colors.more} onPress={() => handleDir("right")} />
      </View>
    </View>
  );
}

const absFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  deck: { flex: 1 },
  emptyDeck: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text,
  },
  emptyCopy: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: "center",
  },
  card: {
    ...absFill,
    borderRadius: radii.card,
    overflow: "hidden",
    backgroundColor: colors.surface,
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  behind: { transform: [{ scale: 0.94 }, { translateY: 14 }], opacity: 0.55 },
  behind2: { transform: [{ scale: 0.88 }, { translateY: 26 }], opacity: 0.3 },
  art: { ...absFill, width: undefined, height: undefined },
  scrimTopGrad: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "30%",
  },
  scrimBottomGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  meta: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 20,
    gap: 6,
  },
  genre: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  genreText: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    letterSpacing: 1.6,
    color: colors.ink,
  },
  title: {
    fontSize: 21,
    fontFamily: fonts.displayBold,
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 26,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 14,
  },
  artistRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  artist: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.artistDim,
  },
  // scrubbable progress bar pinned to the card's bottom edge (web .scrub)
  scrub: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 22,
  },
  scrubTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  scrubFill: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  scrubKnob: {
    position: "absolute",
    bottom: 0,
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  // "keep listening ▸" chip springing in at the card's bottom-right
  chipWrap: {
    position: "absolute",
    right: 14,
    bottom: 18,
    zIndex: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  chipText: {
    fontFamily: fonts.displayBold,
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: colors.ink,
  },
  stamp: {
    position: "absolute",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 3,
    backgroundColor: colors.stampBg,
    zIndex: 3,
  },
  stampText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 1 },
  stampUp: { top: 26, alignSelf: "center", transform: [{ rotate: "-4deg" }] },
  stampDown: { bottom: 96, alignSelf: "center", transform: [{ rotate: "3deg" }] },
  stampRight: { top: 40, left: 22, transform: [{ rotate: "-12deg" }] },
  stampLeft: { top: 40, right: 22, transform: [{ rotate: "12deg" }] },

  // gesture FX
  vignette: {
    ...absFill,
    borderRadius: radii.card,
    borderWidth: 28,
    borderColor: colors.never,
    backgroundColor: colors.neverGlow,
    opacity: 0,
  },
  ring: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -45,
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: colors.more,
    backgroundColor: colors.moreGlow,
    shadowColor: colors.more,
    shadowOpacity: 0.8,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    opacity: 0,
  },

  // action row
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingTop: 16,
    paddingBottom: 6,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: { transform: [{ scale: 0.88 }] },
  primaryBtn: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
});
