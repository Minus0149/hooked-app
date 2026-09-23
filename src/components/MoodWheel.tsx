import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { MOODS, wheelAngle, type Mood, type MoodId } from "../data/mood";
import type { Verdict } from "../data/predict";
import { colors, fonts, withAlpha } from "../design/tokens";
import { Face } from "./faces";

/**
 * The mood ring — the mobile half of web/src/components/MoodWheel.tsx.
 *
 * Six faces orbiting the thumb that summoned them. A big wheel had nowhere to
 * go but the middle of the screen, which made the eye travel away from the
 * finger that was already holding the card. This ring is small, centred on
 * the fingertip, and the faces fly out FROM the finger — which is what tells
 * you where the centre is without drawing anything there, since the thumb
 * covers the centre anyway.
 *
 * The aimed face's name floats above the ring, where a hand can't cover it.
 * Directions are fixed (and mirrored with web in data/mood.ts), so the ring
 * only ever nudges inward near an edge; it never rearranges.
 */

export const RING = 92;
const BUBBLE = 54;
const EDGE = 8;

export interface HostRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function RingFace({
  mood,
  index,
  aimed,
  picked,
  lens,
  onPress,
}: {
  mood: Mood;
  index: number;
  aimed: boolean;
  picked: boolean;
  lens: boolean;
  onPress: () => void;
}) {
  const a = (wheelAngle(index) * Math.PI) / 180;
  const tx = Math.cos(a) * RING;
  const ty = Math.sin(a) * RING;

  // out of the fingertip and into orbit
  const out = useSharedValue(0);
  const grow = useSharedValue(1);
  useEffect(() => {
    out.value = withDelay(index * 22, withSpring(1, { stiffness: 560, damping: 30 }));
  }, [index, out]);
  useEffect(() => {
    grow.value = withSpring(aimed ? 1.2 : 1, { stiffness: 520, damping: 24 });
  }, [aimed, grow]);

  const style = useAnimatedStyle(() => ({
    opacity: out.value,
    transform: [
      { translateX: tx * out.value - BUBBLE / 2 },
      { translateY: ty * out.value - BUBBLE / 2 },
      { scale: (0.3 + 0.7 * out.value) * grow.value },
    ],
  }));

  return (
    <Animated.View style={[styles.faceSlot, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${mood.label} — ${mood.line}`}
        accessibilityState={{ selected: picked }}
        style={[
          styles.bubble,
          { borderColor: picked || lens ? mood.accent : withAlpha(mood.accent, 0.42) },
          (picked || lens) && { borderWidth: 2 },
          aimed && {
            backgroundColor: mood.accent,
            borderColor: mood.accent,
            shadowColor: mood.accent,
          },
        ]}
      >
        <Face mood={mood.id} size={30} color={aimed ? colors.ink : mood.accent} />
      </Pressable>
    </Animated.View>
  );
}

export function MoodWheel({
  origin,
  host,
  aim,
  picked,
  active,
  verdict,
  dragging,
  onCommit,
  onCancel,
}: {
  /** window coordinates of the press that opened it */
  origin: { x: number; y: number };
  /** where the view this ring is drawn inside sits in the window */
  host: HostRect;
  /** the face the finger is pushing toward, or null in the dead zone */
  aim: MoodId | null;
  picked: MoodId | null;
  active: MoodId | null;
  verdict: Verdict | null;
  dragging: boolean;
  onCommit: (mood: MoodId) => void;
  onCancel: () => void;
}) {
  const reach = RING + BUBBLE / 2 + EDGE;
  const fx = origin.x - host.x;
  const fy = origin.y - host.y;
  const cx = Math.min(Math.max(fx, reach), host.width - reach);
  const cy = Math.min(Math.max(fy, reach + 40), host.height - reach);

  const aimIndex = aim ? MOODS.findIndex((m) => m.id === aim) : -1;
  const lead = aimIndex >= 0 ? MOODS[aimIndex] : null;
  const labelBelow = cy - RING - BUBBLE / 2 - 58 < 0;

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(120)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      </Animated.View>

      <View pointerEvents="box-none" style={[styles.ring, { left: cx, top: cy }]}>
        <Animated.View
          entering={FadeIn.duration(180)}
          pointerEvents="none"
          style={[
            styles.track,
            { width: RING * 2, height: RING * 2, left: -RING, top: -RING },
          ]}
        />
        {MOODS.map((m, i) => (
          <RingFace
            key={m.id}
            mood={m}
            index={i}
            aimed={aimIndex === i}
            picked={picked === m.id}
            lens={active === m.id}
            onPress={() => onCommit(m.id)}
          />
        ))}
        <View
          pointerEvents="none"
          style={[
            styles.label,
            { top: labelBelow ? RING + BUBBLE / 2 + 12 : -(RING + BUBBLE / 2 + 52) },
          ]}
        >
          {lead ? (
            <>
              <Text style={[styles.labelTitle, { color: lead.accent }]}>{lead.label}</Text>
              <Text style={styles.labelLine} numberOfLines={1}>
                {lead.line}
              </Text>
            </>
          ) : (
            <Text style={styles.labelLine}>
              {dragging ? "push toward a face" : "tap a face"}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText} numberOfLines={1}>
          {verdict?.worthShowing
            ? `${Math.round(verdict.chance * 100)}% your kind of thing${
                verdict.reasons.length ? ` · ${verdict.reasons.join(", ")}` : ""
              }`
            : "how does this one feel?"}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    backgroundColor: "rgba(3,3,5,0.52)",
  },
  // a point, not a box: everything is laid out around (0,0), the finger
  ring: { position: "absolute", width: 0, height: 0, zIndex: 31 },
  track: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: withAlpha(colors.text, 0.16),
  },
  faceSlot: { position: "absolute", left: 0, top: 0, width: BUBBLE, height: BUBBLE },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,11,16,0.92)",
    borderWidth: 1.5,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  label: {
    position: "absolute",
    left: -130,
    width: 260,
    alignItems: "center",
    gap: 2,
  },
  labelTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(8,8,12,0.86)",
  },
  labelLine: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.muted,
    paddingHorizontal: 11,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(8,8,12,0.7)",
  },
  hint: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 22,
    zIndex: 31,
    alignItems: "center",
  },
  hintText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
});
