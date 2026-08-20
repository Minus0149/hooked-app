import { useEffect, useMemo, useState, type ReactNode } from "react";
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
        not feeling it? <Text style={{ color: "#FFFFFF" }}>swipe up</Text>
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
        love it? <Text style={{ color: colors.save }}>swipe down</Text>
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
        want more like it? <Text style={{ color: colors.more }}>swipe right</Text>
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
        hate it? <Text style={{ color: colors.never }}>swipe left</Text>
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
const LAST_STEP = TASTE_STEPS + GESTURE_STEPS.length + 1;

export function Onboarding({
  demoTracks,
  demoCatalog,
  onFinish,
}: {
  demoTracks: Track[];
  /** the live deck, so the questions only offer what it can serve */
  demoCatalog: Track[];
  onFinish: (taste: TastePrefs) => void;
}) {
  // 0 = welcome, 1-3 = taste, 4-7 = gestures, 8 = done
  const [step, setStep] = useState(0);
  const [taste, setTaste] = useState<TastePrefs>(EMPTY_TASTE);
  const gi = step - TASTE_STEPS;
  const gs = gi >= 1 && gi <= GESTURE_STEPS.length ? GESTURE_STEPS[gi - 1] : null;
  const options = useMemo(() => availableTasteOptions(demoCatalog), [demoCatalog]);
  const finish = () => onFinish(taste);
  const toggle = (key: "languages" | "genres", id: string) =>
    setTaste((t) => ({
      ...t,
      [key]: t[key].includes(id) ? t[key].filter((x) => x !== id) : [...t[key], id],
    }));
  const demoTrack =
    gs && demoTracks.length ? demoTracks[(gi - 1) % demoTracks.length] : null;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <Text style={styles.wordmark}>
        hooked<Text style={{ color: colors.accentDefault }}>.</Text>
      </Text>

      <View style={styles.stepArea}>
        {step === 0 && (
          <Animated.View
            key="welcome"
            entering={FadeInDown.duration(280)}
            exiting={FadeOutUp.duration(180)}
            style={styles.stepWrap}
          >
            <Text style={styles.headline}>
              your next favorite song is{" "}
              <Text style={{ color: colors.accentDefault }}>one swipe away</Text>
            </Text>
            <Text style={styles.copy}>
              We play you the best part of songs you've never heard. Four swipes
              teach us exactly what you love.
            </Text>
          </Animated.View>
        )}

        {step >= 1 && step <= TASTE_STEPS && (
          <Animated.View
            key={`taste-${step}`}
            entering={FadeInDown.duration(280)}
            exiting={FadeOutUp.duration(180)}
            style={styles.stepWrap}
          >
            <Text style={[styles.headline, styles.headlineSm]}>
              {step === 1
                ? "what do you listen in?"
                : step === 2
                  ? "and what sounds?"
                  : "how far off the map?"}
            </Text>
            {step < 3 && (
              <Text style={styles.copy}>
                {step === 1
                  ? "Pick as many as you like. This matters more than genre."
                  : "A rough steer, not a filter."}
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

        {step === 5 && (
          <Animated.View
            key="done"
            entering={FadeInDown.duration(280)}
            style={styles.stepWrap}
          >
            <Text style={styles.headline}>
              you're <Text style={{ color: colors.accentDefault }}>ready.</Text>
            </Text>
            <Text style={styles.copy}>
              One more thing: the ↩ button up top always brings back the last
              song, in case you swipe too fast.
            </Text>
          </Animated.View>
        )}
      </View>

      <View style={styles.dots}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Dot key={i} on={i <= step} />
        ))}
      </View>

      {step === 0 && (
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          onPress={() => setStep(1)}
        >
          <Text style={styles.primaryText}>Show me how</Text>
        </Pressable>
      )}
      {step > 0 && step < 5 && (
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
      {step === 5 && (
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          onPress={finish}
        >
          <Text style={styles.primaryText}>Start discovering</Text>
        </Pressable>
      )}

      {step < 5 ? (
        <Pressable style={styles.skip} hitSlop={8} onPress={finish}>
          <Text style={styles.skipText}>Skip the tour</Text>
        </Pressable>
      ) : (
        <View style={styles.skip} />
      )}

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
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  chipOn: {
    borderColor: colors.accentDefault,
    backgroundColor: "rgba(255,61,113,0.16)",
  },
  chipText: { color: colors.muted, fontSize: 13.5, fontWeight: "600" },
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
  choiceLabel: { color: colors.text, fontSize: 14.5, fontWeight: "700" },
  choiceCopy: { color: colors.muted, fontSize: 12 },
  root: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  stepArea: { flex: 1, justifyContent: "center" },
  stepWrap: { alignItems: "center", gap: 18 },
  headline: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 31,
    color: colors.text,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  headlineSm: { fontSize: 20, lineHeight: 25 },
  copy: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 300,
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
