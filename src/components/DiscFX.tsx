import { useEffect, useRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { Track } from "../types";
import { colors, fonts, mixHex, radii, withAlpha } from "../design/tokens";

// release pose captured from the pan gesture so the disc inherits momentum
export interface SaveRelease {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SaveFxData {
  key: number;
  track: Track;
  from: SaveRelease;
  mode: "fast" | "cinematic";
}

const DISC = 96; // disc diameter
const SLEEVE_W = 172;
const SLEEVE_H = 152;
const SLEEVE_BOTTOM = -10; // pokes below the deck edge
const LIP = 13; // slot depth: disc is visible against the dark interior for this many px

// ms-based timings (web version uses seconds)
const TIMING = {
  fast: { morph: 160, slide: 120, spin: 120, hover: 0, linger: 120 },
  cinematic: { morph: 260, slide: 200, spin: 260, hover: 120, linger: 360 },
} as const;

/**
 * The save moment: the released card keeps your swipe's momentum, morphs into
 * a spinning vinyl disc (album art becomes the label), and slides into an
 * album sleeve printed with the track's own artwork. The sleeve is a sandwich
 * — back panel behind the disc, front face clipped below the slot line — so
 * the disc visibly enters the mouth instead of hiding behind a square.
 * Mirrors web/src/components/DiscFX.tsx.
 */
export function DiscFX({
  data,
  deckW,
  deckH,
  sticker,
  onDone,
}: {
  data: SaveFxData;
  deckW: number;
  deckH: number;
  sticker: string;
  onDone: () => void;
}) {
  const { from, track, mode } = data;

  // disc body — starts as the card (full deck size, card radius, drag rotation)
  const x = useSharedValue(from.x);
  const y = useSharedValue(from.y);
  const w = useSharedValue(deckW);
  const h = useSharedValue(deckH);
  const br = useSharedValue(radii.card);
  const spin = useSharedValue((from.x / 220) * 13); // inherit the drag tilt
  const morph = useSharedValue(0);
  const dim = useSharedValue(0);
  const discOpacity = useSharedValue(1);

  // sleeve
  const sleeveY = useSharedValue(SLEEVE_H + 40);
  const sleeveRot = useSharedValue(-6);
  const sleeveSquash = useSharedValue(1);
  const stickerPop = useSharedValue(0);
  const layerOpacity = useSharedValue(1);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = useRef(true);

  useEffect(() => {
    const t = TIMING[mode];
    const easeIn = Easing.in(Easing.quad);
    const easeOut = Easing.out(Easing.quad);

    // geometry (coordinates are relative to the deck center, like the card's)
    const sleeveTopY = deckH / 2 + SLEEVE_BOTTOM - SLEEVE_H;
    const hoverY = sleeveTopY - DISC / 2 - 6; // disc bottom kisses the mouth
    const inY = sleeveTopY + LIP + DISC / 2 + 26; // fully swallowed

    const finish = () => {
      if (alive.current) onDone();
    };

    const leave = () => {
      if (!alive.current) return;
      sleeveRot.value = withTiming(4, { duration: 180 });
      // fade the whole layer too, so nothing can visibly linger over the
      // action row / nav even if a completion callback is dropped
      layerOpacity.value = withTiming(0, { duration: 170 });
      sleeveY.value = withTiming(
        SLEEVE_H + 60,
        { duration: 180, easing: easeIn },
        (finished) => {
          if (finished) runOnJS(finish)();
        },
      );
    };

    const thunk = () => {
      if (!alive.current) return;
      // the disc is now fully covered by the sleeve face — fade it out here so
      // nothing gets revealed (no "ghost") when the sleeve slides away later
      discOpacity.value = withTiming(0, { duration: 110 });
      sleeveSquash.value = withSequence(
        withTiming(0.93, { duration: 86, easing: easeOut }),
        withTiming(1, { duration: 106 }),
      );
      sleeveY.value = withSequence(
        withTiming(7, { duration: 83, easing: easeOut }),
        withTiming(0, { duration: 125 }),
      );
      stickerPop.value = withSpring(1, { stiffness: 520, damping: 16 });
      timers.current.push(setTimeout(leave, t.linger));
    };

    const slideIn = () => {
      if (!alive.current) return;
      // NOW it spins — a modest turn while disc-sized, sliding into the mouth
      spin.value = withTiming(t.spin, { duration: t.slide + 180, easing: easeOut });
      dim.value = withTiming(0.65, { duration: t.slide });
      y.value = withTiming(inY, { duration: t.slide, easing: easeIn }, (finished) => {
        if (finished) runOnJS(thunk)();
      });
    };

    // the flight is two springs (x and y) — move on once both have settled.
    // `started` guards the fallback timer below so slideIn only fires once.
    let springsDone = 0;
    let started = false;
    const startSlideIn = () => {
      if (!alive.current || started) return;
      started = true;
      if (t.hover) {
        // cinematic beat: the disc hangs over the slot
        timers.current.push(setTimeout(slideIn, t.hover));
      } else {
        slideIn();
      }
    };
    const onSpringSettled = () => {
      if (!alive.current) return;
      springsDone += 1;
      if (springsDone < 2) return;
      startSlideIn();
    };
    // springs can take their time reporting "done" — if they haven't settled
    // soon after the morph, slide in anyway so the disc never hangs around
    timers.current.push(setTimeout(startSlideIn, 230));
    // ultimate safety net: whatever happens to the animation chain, the
    // overlay always unmounts
    timers.current.push(setTimeout(finish, 2600));

    // sleeve slides up while the card SHRINKS mid-flight — no rotation yet;
    // spinning a card-sized rectangle reads as chaos, so the tilt just settles
    sleeveY.value = withSpring(0, { stiffness: 520, damping: 30 });
    sleeveRot.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    w.value = withTiming(DISC, { duration: t.morph, easing: easeIn });
    h.value = withTiming(DISC, { duration: t.morph, easing: easeIn });
    br.value = withTiming(DISC / 2, { duration: t.morph, easing: easeIn });
    morph.value = withTiming(1, { duration: t.morph });
    spin.value = withTiming(0, { duration: t.morph, easing: easeOut }); // settle the drag tilt
    // momentum-seeded springs: the disc continues the way you threw it.
    // a loose energyThreshold (Reanimated 4's stand-in for the old
    // restDisplacement/restSpeed thresholds) makes them report "done" quickly
    // instead of micro-oscillating — the disc shouldn't hover over the slot
    x.value = withSpring(
      0,
      {
        stiffness: 480,
        damping: 34,
        velocity: from.vx,
        energyThreshold: 1e-4,
      },
      () => runOnJS(onSpringSettled)(),
    );
    y.value = withSpring(
      hoverY,
      {
        stiffness: 480,
        damping: 34,
        velocity: Math.max(from.vy, 300),
        energyThreshold: 1e-4,
      },
      () => runOnJS(onSpringSettled)(),
    );

    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const discStyle = useAnimatedStyle(() => ({
    width: w.value,
    height: h.value,
    borderRadius: br.value,
    marginLeft: -w.value / 2,
    marginTop: -h.value / 2,
    opacity: discOpacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${spin.value}deg` },
    ],
  }));
  const artStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.55], [1, 0], Extrapolation.CLAMP),
  }));
  const vinylStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0.25, 0.75], [0, 1], Extrapolation.CLAMP),
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sleeveStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: sleeveY.value },
      { rotate: `${sleeveRot.value}deg` },
      { scaleY: sleeveSquash.value },
    ],
  }));
  const stickerStyle = useAnimatedStyle(() => ({
    opacity: stickerPop.value,
    transform: [{ rotate: "8deg" }, { scale: stickerPop.value }],
  }));

  const layerStyle = useAnimatedStyle(() => ({ opacity: layerOpacity.value }));

  return (
    <Animated.View style={[styles.fxLayer, layerStyle]} pointerEvents="none">
      {/* back panel + dark interior — the disc passes IN FRONT of this */}
      <Animated.View style={[styles.sleeve, sleeveStyle]}>
        <View style={styles.sleeveBack}>
          <LinearGradient
            colors={["#060609", "#110e15", "#15121a"]}
            locations={[0, 0.3, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </Animated.View>

      {/* the card-turned-disc */}
      <Animated.View style={[styles.disc, discStyle]}>
        <Animated.Image
          source={{ uri: track.artwork }}
          style={[styles.discArt, artStyle]}
        />
        <Animated.View style={[styles.vinyl, vinylStyle]}>
          {/* grooves: RN has no repeating-radial-gradient — suggest them with
              concentric hairline rings */}
          <View style={styles.vinylInner}>
            <View style={[styles.groove, grooveSize(86)]} />
            <View style={[styles.groove, grooveSize(72)]} />
            <View style={[styles.groove, grooveSize(58)]} />
            <View style={[styles.groove, grooveSize(46)]} />
            {/* center label: the track's own artwork */}
            <Image
              source={{ uri: track.artwork }}
              style={[styles.discLabel, { borderColor: track.accent }]}
            />
            <View style={styles.discHole} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.discDim, dimStyle]} />
      </Animated.View>

      {/* front face, clipped below the slot line — the disc slides BEHIND this */}
      <Animated.View style={[styles.sleeve, sleeveStyle]}>
        <View
          style={[
            styles.sleeveFrontClip,
            { borderColor: mixHex(track.accent, "#2a2430", 0.55) },
          ]}
        >
          <Image source={{ uri: track.artwork }} style={styles.sleeveArt} />
          <LinearGradient
            colors={[withAlpha(track.accent, 0.38), "rgba(8,8,12,0.9)"]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.55, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* inner shadow under the slot lip, selling the mouth's depth */}
          <LinearGradient
            colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0)"]}
            style={styles.slotShadow}
          />
          <Text style={styles.wordmark}>hooked.</Text>
        </View>
        <Animated.View
          style={[styles.sticker, { backgroundColor: track.accent }, stickerStyle]}
        >
          <Text style={styles.stickerText}>{sticker}</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function grooveSize(size: number) {
  return { width: size, height: size, borderRadius: size / 2 };
}

const absFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  fxLayer: {
    ...absFill,
    zIndex: 9,
    // beat the top card's elevation on Android so the FX paints above it
    elevation: 24,
  },

  // both sleeve layers share this footprint and move in sync
  sleeve: {
    position: "absolute",
    bottom: SLEEVE_BOTTOM,
    left: "50%",
    marginLeft: -SLEEVE_W / 2,
    width: SLEEVE_W,
    height: SLEEVE_H,
  },
  sleeveBack: {
    ...absFill,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#241f2b",
    overflow: "hidden",
    backgroundColor: "#060609",
    shadowColor: "#000",
    shadowOpacity: 0.7,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -12 },
  },
  // front face: the top LIP px is simply not rendered, which creates the slot
  sleeveFrontClip: {
    position: "absolute",
    top: LIP,
    left: 0,
    right: 0,
    height: SLEEVE_H - LIP,
    overflow: "hidden",
    backgroundColor: "#15121a",
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  // artwork offset up by the lip so it aligns with the full sleeve footprint;
  // opacity over the dark base stands in for CSS saturate(0.75)
  sleeveArt: {
    position: "absolute",
    top: -LIP,
    left: 0,
    right: 0,
    height: SLEEVE_H,
    opacity: 0.82,
  },
  slotShadow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 16,
  },
  wordmark: {
    position: "absolute",
    right: 8,
    bottom: 6,
    fontFamily: fonts.display,
    fontSize: 9,
    letterSpacing: 0.2,
    color: "rgba(244,242,238,0.85)",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  sticker: {
    position: "absolute",
    top: -9,
    right: -10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  stickerText: {
    fontFamily: fonts.display,
    fontSize: 11.5,
    lineHeight: 14,
    color: colors.ink,
  },

  // the card-turned-vinyl
  disc: {
    position: "absolute",
    top: "50%",
    left: "50%",
    overflow: "hidden",
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 18 },
  },
  discArt: { ...absFill },
  vinyl: {
    ...absFill,
    backgroundColor: "#0a0a0e",
    alignItems: "center",
    justifyContent: "center",
  },
  vinylInner: {
    width: DISC,
    height: DISC,
    alignItems: "center",
    justifyContent: "center",
  },
  groove: {
    position: "absolute",
    alignSelf: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.05)",
  },
  discLabel: {
    width: DISC * 0.42,
    height: DISC * 0.42,
    borderRadius: (DISC * 0.42) / 2,
    borderWidth: 2,
  },
  discHole: {
    position: "absolute",
    alignSelf: "center",
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#060609",
  },
  discDim: {
    ...absFill,
    backgroundColor: "rgb(2,2,5)",
    opacity: 0,
  },
});
