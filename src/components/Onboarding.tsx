import { TOUR_COPY, tasteStepButton, type TourHeadline } from "../lib/tourCopy";
import { Eq } from "./Eq";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Dimensions,
  Pressable,
  Image,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SwipeDir, Track } from "../types";
import {
  ADVENTURE,
  EMPTY_TASTE,
  availableTasteOptions,
  type TastePrefs,
} from "../data/taste";
import { resolveDirWorklet } from "./SwipeDeck";
import { MoodWheel, type HostRect } from "./MoodWheel";
import { moodAtPush, moodById, type MoodId } from "../data/mood";
import { colors, fonts, radii } from "../design/tokens";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const DEMO_W = Math.min(240, SCREEN_W * 0.6);

interface GestureStep {
  dir: SwipeDir;
  headline: ReactNode;
  copy: string;
  color: string;
  arrow: string;
  /** where the pulsing arrow sits, just outside the demo card */
  arrowWrap: ViewStyle;
}

const GESTURE_STEPS: GestureStep[] = [
  {
    dir: "up",
    headline: (
      <>
        not feeling it? <Text style={{ color: colors.accentDefault }}>swipe up</Text>
      </>
    ),
    copy: "Skips to the next song instantly. No hard feelings — we learn from it anyway.",
    color: "#FFFFFF",
    arrow: "↑",
    arrowWrap: { top: -46, left: 0, right: 0, alignItems: "center" },
  },
  {
    dir: "down",
    headline: (
      <>
        love it? <Text style={{ color: colors.accentDefault }}>swipe down</Text>
      </>
    ),
    copy: "Saves it to your Liked Songs or a playlist — you choose where in settings.",
    color: colors.save,
    arrow: "↓",
    arrowWrap: { bottom: -46, left: 0, right: 0, alignItems: "center" },
  },
  {
    dir: "right",
    headline: (
      <>
        want more like it? <Text style={{ color: colors.accentDefault }}>swipe right</Text>
      </>
    ),
    copy: "Doesn't save it — just tells the algorithm to chase this exact vibe.",
    color: colors.more,
    arrow: "→",
    arrowWrap: { right: -42, top: 0, bottom: 0, justifyContent: "center" },
  },
  {
    dir: "left",
    headline: (
      <>
        hate it? <Text style={{ color: colors.accentDefault }}>swipe left</Text>
      </>
    ),
    copy: "Never plays it again, and steers your feed far away from it.",
    color: colors.never,
    arrow: "←",
    arrowWrap: { left: -42, top: 0, bottom: 0, justifyContent: "center" },
  },
];

/** Arrow that pulses outside the demo card on the side the user must swipe toward. */
function PulseArrow({ glyph, color }: { glyph: string; color: string }) {
  const v = useSharedValue(0.35);

  useEffect(() => {
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0.35, { duration: 700 }),
      ),
      -1,
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: v.value }));

  return (
    <Animated.Text style={[styles.arrow, { color }, style]}>{glyph}</Animated.Text>
  );
}

/**
 * The little practice card. Same pan + resolveDir math as the real SwipeDeck;
 * the required direction flies the card off and advances, any other committed
 * direction springs back with a horizontal wiggle.
 */
function DemoCard({
  track,
  requiredDir,
  color,
  onDone,
}: {
  track: Track;
  requiredDir: SwipeDir;
  color: string;
  onDone: () => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const done = useSharedValue(false);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (done.value) return;
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd((e) => {
      if (done.value) return;
      const dir = resolveDirWorklet(
        e.translationX,
        e.translationY,
        e.velocityX,
        e.velocityY,
      );
      if (dir === requiredDir) {
        done.value = true;
        const tx =
          dir === "right" ? SCREEN_W * 1.1 : dir === "left" ? -SCREEN_W * 1.1 : 0;
        const ty =
          dir === "up" ? -SCREEN_H * 0.9 : dir === "down" ? SCREEN_H * 0.9 : 0;
        x.value = withTiming(tx, { duration: 240 });
        y.value = withTiming(ty, { duration: 240 }, (finished) => {
          if (finished) runOnJS(onDone)();
        });
        return;
      }
      if (dir) {
        // committed the wrong way — spring home, then shake "no"
        y.value = withSpring(0, { stiffness: 320, damping: 26 });
        x.value = withSequence(
          withTiming(0, { duration: 110 }),
          withTiming(-8, { duration: 55 }),
          withTiming(8, { duration: 55 }),
          withTiming(-5, { duration: 55 }),
          withTiming(5, { duration: 55 }),
          withTiming(0, { duration: 55 }),
        );
        return;
      }
      x.value = withSpring(0, { stiffness: 320, damping: 26 });
      y.value = withSpring(0, { stiffness: 320, damping: 26 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-160, 160], [-12, 12])}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={FadeIn.duration(220)}
        style={[styles.demoCard, cardStyle]}
      >
        <Image source={{ uri: track.artwork }} style={styles.demoArt} />
        <LinearGradient
          colors={[colors.scrimFade, colors.scrimBottom]}
          style={styles.demoScrim}
          pointerEvents="none"
        />
        <View style={styles.demoMeta} pointerEvents="none">
          <Text style={styles.demoTitle} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.demoArtist} numberOfLines={1}>
            {track.artist}
          </Text>
        </View>
        <View
          pointerEvents="none"
          style={[styles.demoDash, { borderColor: color }]}
        />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * The fifth gesture, which nothing else teaches.
 *
 * A swipe announces itself — the card moves the instant you touch it. A hold
 * shows nothing until it fires, so you either know it is there or you never
 * find it. This card is held rather than swiped: the ring opens around the
 * thumb, and the push that picks a face is the same push the deck uses, so the
 * tour teaches the real gesture rather than a simplified one.
 */
function HoldDemo({
  track,
  onOpen,
  onAim,
  onRelease,
}: {
  track: Track;
  onOpen: (x: number, y: number) => void;
  onAim: (dx: number, dy: number) => void;
  onRelease: () => void;
}) {
  const press = useSharedValue(1);
  const hold = Gesture.Pan()
    .activateAfterLongPress(420)
    .onBegin(() => {
      press.value = withTiming(0.97, { duration: 420 });
    })
    .onStart((e) => {
      runOnJS(onOpen)(e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      runOnJS(onAim)(e.translationX, e.translationY);
    })
    .onEnd(() => {
      runOnJS(onRelease)();
    })
    .onFinalize(() => {
      press.value = withSpring(1, { stiffness: 380, damping: 28 });
    });
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    <GestureDetector gesture={hold}>
      <Animated.View entering={FadeIn.duration(220)} style={[styles.demoCard, style]}>
        <Image source={{ uri: track.artwork }} style={styles.demoArt} />
        <LinearGradient
          colors={[colors.scrimFade, colors.scrimBottom]}
          style={styles.demoScrim}
          pointerEvents="none"
        />
        <View style={styles.demoMeta} pointerEvents="none">
          <Text style={styles.demoTitle} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.demoArtist} numberOfLines={1}>
            {track.artist}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Progress dot — the active ones stretch wide and go accent. */
function Dot({ on }: { on: boolean }) {
  const style = useAnimatedStyle(
    () => ({
      width: withTiming(on ? 22 : 7, { duration: 250 }),
      backgroundColor: withTiming(on ? colors.accentDefault : "#2C2C36", {
        duration: 250,
      }),
    }),
    [on],
  );
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * Web's interactive Onboarding: step 0 welcome, steps 1-4 make the user
 * actually perform each swipe on a demo card, step 5 wraps up.
 */
const TASTE_STEPS = 3;
/** welcome + taste + the four swipes + the hold */
const HOLD_STEP = TASTE_STEPS + GESTURE_STEPS.length + 1;
/**
 * ...and done. Named, not written as a number: this file used to say `5`
 * here, which was right before the taste questions were added and wrong after
 * — step 5 then drew the swipe-down demo AND "you're ready" at once, with a
 * "Start discovering" button that skipped three of the four gestures.
 */
const LAST_STEP = HOLD_STEP + 1;

export function Onboarding({
  demoTracks,
  demoCatalog,
  onFinish,
}: {
  demoTracks: Track[];
  /** the live deck, so the questions only offer what it can serve */
  demoCatalog: Track[];
  onFinish: (taste: TastePrefs, mood: MoodId | null) => void;
}) {
  // 0 = welcome, 1-3 = taste, 4-7 = the four swipes, 8 = the hold, 9 = done
  const [step, setStep] = useState(0);
  const [taste, setTaste] = useState<TastePrefs>(EMPTY_TASTE);
  const [mood, setMood] = useState<MoodId | null>(null);

  // the ring, exactly as the deck runs it
  const rootRef = useRef<View>(null);
  const [host, setHost] = useState<HostRect>({ x: 0, y: 0, width: SCREEN_W, height: SCREEN_H });
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);
  const [aim, setAim] = useState<MoodId | null>(null);
  const [dragging, setDragging] = useState(false);
  const closeRing = useCallback(() => {
    setRing(null);
    setAim(null);
    setDragging(false);
  }, []);
  const openRing = useCallback((x: number, y: number) => {
    rootRef.current?.measureInWindow((hx, hy, width, height) =>
      setHost({ x: hx, y: hy, width, height }),
    );
    setRing({ x, y });
    setAim(null);
    setDragging(true);
  }, []);
  const aimRing = useCallback((dx: number, dy: number) => setAim(moodAtPush(dx, dy, 38)), []);
  const releaseRing = useCallback(() => setDragging(false), []);
  const wasDragging = useRef(false);
  useEffect(() => {
    if (wasDragging.current && !dragging && aim) {
      setMood(aim);
      closeRing();
    }
    wasDragging.current = dragging;
  }, [dragging, aim, closeRing]);
  const gi = step - TASTE_STEPS;
  const gs =
    step < HOLD_STEP && gi >= 1 && gi <= GESTURE_STEPS.length ? GESTURE_STEPS[gi - 1] : null;
  const options = useMemo(() => availableTasteOptions(demoCatalog), [demoCatalog]);
  const finish = () => onFinish(taste, mood);
  const toggle = (key: "languages" | "genres", id: string) =>
    setTaste((t) => ({
      ...t,
      [key]: t[key].includes(id) ? t[key].filter((x) => x !== id) : [...t[key], id],
    }));
  const demoTrack =
    gs && demoTracks.length ? demoTracks[(gi - 1) % demoTracks.length] : null;

  return (
    <SafeAreaView ref={rootRef} style={styles.root} edges={["top", "bottom"]}>
      <Text style={styles.wordmark}>
        hookedcue<Text style={{ color: colors.accentDefault }}>.</Text>
      </Text>

      <View style={styles.stepArea}>
        {step === 0 && (
          <Animated.View
            key="welcome"
            entering={FadeInDown.duration(280)}
            exiting={FadeOutUp.duration(180)}
            style={styles.stepWrap}
          >
            <Headline h={TOUR_COPY.welcome.headline} />
            <Text style={styles.copy}>{TOUR_COPY.welcome.copy}</Text>
            <Eq color={colors.accentDefault} playing />
          </Animated.View>
        )}

        {step >= 1 && step <= TASTE_STEPS && (
          <Animated.View
            key={`taste-${step}`}
            entering={FadeInDown.duration(280)}
            exiting={FadeOutUp.duration(180)}
            style={styles.stepWrap}
          >
            <Headline
              h={
                step === 1
                  ? TOUR_COPY.languages.headline
                  : step === 2
                    ? TOUR_COPY.genres.headline
                    : TOUR_COPY.adventure.headline
              }
            />
            {step < 3 && (
              <Text style={styles.copy}>
                {step === 1 ? TOUR_COPY.languages.copy : TOUR_COPY.genres.copy}
              </Text>
            )}
            {step === 3 ? (
              <View style={styles.choices}>
                {ADVENTURE.map((a) => {
                  const on = taste.adventure === a.id;
                  return (
                    <Pressable
                      key={a.id}
                      style={[styles.choice, on && styles.choiceOn]}
                      onPress={() => setTaste((t) => ({ ...t, adventure: a.id }))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${a.label}. ${a.copy}`}
                    >
                      <Text style={styles.choiceLabel}>{a.label}</Text>
                      <Text style={styles.choiceCopy}>{a.copy}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.chips}>
                {(step === 1 ? options.languages : options.genres).map((o) => {
                  const key = step === 1 ? "languages" : "genres";
                  const on = taste[key].includes(o.id);
                  return (
                    <Pressable
                      key={o.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => toggle(key, o.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={o.label}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Animated.View>
        )}

        {gs && (
          <Animated.View
            key={gs.dir}
            entering={FadeInDown.duration(280)}
            exiting={FadeOutUp.duration(180)}
            style={styles.stepWrap}
          >
            <Text style={[styles.headline, styles.headlineSm]}>{gs.headline}</Text>
            <View style={styles.demo}>
              <View style={[styles.arrowWrap, gs.arrowWrap]} pointerEvents="none">
                <PulseArrow glyph={gs.arrow} color={gs.color} />
              </View>
              {demoTrack && (
                <DemoCard
                  key={gs.dir}
                  track={demoTrack}
                  requiredDir={gs.dir}
                  color={gs.color}
                  onDone={() => setStep((s) => s + 1)}
                />
              )}
            </View>
            <Text style={styles.copy}>{gs.copy}</Text>
          </Animated.View>
        )}

        {step === HOLD_STEP && (
          <Animated.View
            key="hold"
            entering={FadeInDown.duration(280)}
            exiting={FadeOutUp.duration(180)}
            style={styles.stepWrap}
          >
            <Text style={[styles.headline, styles.headlineSm]}>
              and <Text style={{ color: colors.accentDefault }}>hold</Text>, then push
            </Text>
            <View style={styles.demo}>
              {demoTracks.length > 0 ? (
                <HoldDemo
                  track={demoTracks[0]}
                  onOpen={openRing}
                  onAim={aimRing}
                  onRelease={releaseRing}
                />
              ) : null}
            </View>
            <Text style={styles.copy}>
              {mood
                ? `Nice — we'll open with ${moodById(mood)?.label.toLowerCase()}. Hold any card to change it, any time.`
                : TOUR_COPY.hold.copy}
            </Text>
          </Animated.View>
        )}

        {step === LAST_STEP && (
          <Animated.View
            key="done"
            entering={FadeInDown.duration(280)}
            style={styles.stepWrap}
          >
            <Text style={styles.headline}>
              you're <Text style={{ color: colors.accentDefault }}>ready.</Text>
            </Text>
            <Text style={styles.copy}>
              Four swipes and a hold. The ↩ button up top always brings back
              the last song, in case you go too fast.
            </Text>
          </Animated.View>
        )}
      </View>

      <View style={styles.dots}>
        {Array.from({ length: LAST_STEP + 1 }, (_, i) => (
          <Dot key={i} on={i <= step} />
        ))}
      </View>

      {step === 0 && (
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          onPress={() => setStep(1)}
        >
          <Text style={styles.primaryText}>{TOUR_COPY.start}</Text>
        </Pressable>
      )}
      {step >= 1 && step <= TASTE_STEPS && (
        // never blocked on an answer — an empty one simply tilts nothing
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          onPress={() => setStep(step + 1)}
        >
          <Text style={styles.primaryText}>{tasteStepButton(step, taste)}</Text>
        </Pressable>
      )}
      {step > TASTE_STEPS && step < HOLD_STEP && (
        <Pressable
          style={[styles.primary, { opacity: 0.25 }]}
          disabled={demoTrack !== null}
          // safety hatch: with no demo tracks the card can't render, so let
          // the button advance instead of dead-ending the tour
          onPress={() => setStep((s) => s + 1)}
        >
          <Text style={styles.primaryText}>Swipe the card to continue</Text>
        </Pressable>
      )}
      {step === HOLD_STEP && (
        <Pressable
          style={({ pressed }) => [
            styles.primary,
            !mood && demoTracks.length > 0 && { opacity: 0.25 },
            pressed && styles.primaryPressed,
          ]}
          disabled={!mood && demoTracks.length > 0}
          onPress={() => setStep(LAST_STEP)}
        >
          <Text style={styles.primaryText}>
            {mood || demoTracks.length === 0 ? "Next" : "Hold the card to continue"}
          </Text>
        </Pressable>
      )}
      {step === LAST_STEP && (
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          onPress={finish}
        >
          <Text style={styles.primaryText}>Start discovering</Text>
        </Pressable>
      )}

      {step < LAST_STEP ? (
        <Pressable style={styles.skip} hitSlop={8} onPress={finish}>
          <Text style={styles.skipText}>{TOUR_COPY.skip}</Text>
        </Pressable>
      ) : (
        <View style={styles.skip} />
      )}

      {ring && step === HOLD_STEP ? (
        <MoodWheel
          origin={ring}
          host={host}
          aim={aim}
          picked={mood}
          active={mood}
          verdict={null}
          dragging={dragging}
          onCommit={(m) => {
            setMood(m);
            closeRing();
          }}
          onCancel={closeRing}
        />
      ) : null}

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const absFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/** A tour headline: the plain lead, then the accented end (web's <em>). */
function Headline({ h, small = false }: { h: TourHeadline; small?: boolean }) {
  return (
    <Text style={[styles.headline, small && styles.headlineSm]}>
      {h.lead} <Text style={{ color: colors.accentDefault }}>{h.accent}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 18,
    maxWidth: 340,
    alignSelf: "center",
  },
  // 44 tall, as on the web: the smallest thing a thumb hits reliably
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  chipOn: {
    borderColor: colors.accentDefault,
    backgroundColor: "rgba(255,61,113,0.16)",
  },
  chipText: { color: colors.muted, fontSize: 13.5, fontFamily: fonts.bodySemiBold },
  chipTextOn: { color: colors.text },
  choices: { gap: 10, marginTop: 18, width: "100%", maxWidth: 340, alignSelf: "center" },
  choice: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 3,
  },
  choiceOn: {
    borderColor: colors.accentDefault,
    backgroundColor: "rgba(255,61,113,0.14)",
  },
  choiceLabel: { color: colors.text, fontSize: 14.5, fontFamily: fonts.bodyBold },
  choiceCopy: { color: colors.muted, fontSize: 12, fontFamily: fonts.body },
  root: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  stepArea: { flex: 1, justifyContent: "center" },
  stepWrap: { alignItems: "center", gap: 22 },
  // web .ob-headline at a phone's width: clamp(26px, 7.5vw, 34px) is ~30
  headline: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 33,
    color: colors.text,
    letterSpacing: -0.9,
    textAlign: "center",
  },
  // the gesture steps' smaller headline (web sets 22px inline there)
  headlineSm: { fontSize: 22, lineHeight: 25, letterSpacing: -0.6 },
  copy: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22.5,
    textAlign: "center",
    maxWidth: 280,
  },
  // 3:4 practice area — extra margin leaves room for the arrow outside it
  demo: { width: DEMO_W, aspectRatio: 3 / 4, marginVertical: 36 },
  arrowWrap: { position: "absolute", zIndex: 4 },
  arrow: { fontFamily: fonts.bodyBold, fontSize: 26, lineHeight: 30 },
  demoCard: {
    ...absFill,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  demoArt: { ...absFill, width: undefined, height: undefined },
  demoScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  demoMeta: { position: "absolute", left: 14, right: 14, bottom: 12, gap: 2 },
  demoTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: colors.text,
    letterSpacing: -0.2,
  },
  demoArtist: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.artistDim },
  demoDash: {
    ...absFill,
    borderRadius: 24,
    borderWidth: 2.5,
    borderStyle: "dashed",
    opacity: 0.7,
  },
  dots: {
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginVertical: 18,
  },
  dot: { height: 7, borderRadius: radii.pill },
  primary: {
    backgroundColor: colors.text,
    borderRadius: 18,
    padding: 17,
    alignItems: "center",
  },
  primaryPressed: { transform: [{ scale: 0.97 }] },
  primaryText: { fontFamily: fonts.displayBold, color: colors.ink, fontSize: 15 },
  skip: { marginTop: 14, alignItems: "center", minHeight: 20 },
  skipText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.muted },
});
