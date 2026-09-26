import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import { MOODS, wedgePath, wedgePoint, type Mood, type MoodId } from "../data/mood";
import type { Verdict } from "../data/predict";
import { colors, fonts, withAlpha } from "../design/tokens";
import { Face } from "./faces";
import { useFaceIdle } from "./faceMotion";

/**
 * The mood ring — the mobile half of web/src/components/MoodWheel.tsx.
 *
 * A wheel of six wedges around the thumb that summoned it, like a game's
 * emote wheel. The push rule already gives every face a full 60 degrees, so
 * the wheel draws exactly that: what you see is what the finger can hit. The
 * hole in the middle is where the thumb is — coming back into it and letting
 * go cancels. The aimed wedge fills with its colour and steps out, and its
 * name floats above the ring, where a hand can't cover it.
 *
 * Directions are fixed (and mirrored with web in data/mood.ts), so the ring
 * only ever nudges inward near an edge; it never rearranges.
 */

/** outer edge of the wheel */
export const R_OUT = 116;
/** the hole — where the thumb sits */
const R_IN = 46;
/** where each face and its name sit along the wedge */
const FACE_R = 80;
/** face a little above that point, name a little below: stacked, not radial */
const FACE_DY = -8;
const NAME_DY = 16;
/** trim on each side of a wedge, degrees — the dark seams between keys */
const GAP = 1.1;
/** how far the aimed wedge steps out */
const POP = 6;
const EDGE = 6;
/** height of the hint strip at the bottom, which the ring must not cover */
const HINT_ROOM = 44;
/** the svg canvas: the wheel plus room for the popped wedge */
const CANVAS = (R_OUT + POP + 14) * 2;
const FACE_BOX = 44;

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
  lively,
  onPress,
}: {
  mood: Mood;
  index: number;
  aimed: boolean;
  picked: boolean;
  /** play the face's idle loop (the in-app motion setting is "full") */
  lively: boolean;
  onPress: () => void;
}) {
  const idleStyle = useFaceIdle(mood.id, index, aimed, lively);
  const rest = wedgePoint(index, FACE_R);
  const popped = wedgePoint(index, FACE_R + POP);

  // out of the fingertip and into the wheel
  const out = useSharedValue(0);
  const push = useSharedValue(0);
  useEffect(() => {
    out.value = withDelay(30 + index * 20, withSpring(1, { stiffness: 560, damping: 30 }));
  }, [index, out]);
  useEffect(() => {
    push.value = withSpring(aimed ? 1 : 0, { stiffness: 520, damping: 24 });
  }, [aimed, push]);

  const style = useAnimatedStyle(() => {
    const x = rest.x + (popped.x - rest.x) * push.value;
    const y = rest.y + (popped.y - rest.y) * push.value + FACE_DY;
    return {
      opacity: out.value,
      transform: [
        { translateX: x * out.value - FACE_BOX / 2 },
        { translateY: y * out.value - FACE_BOX / 2 },
        { scale: (0.3 + 0.7 * out.value) * (1 + 0.18 * push.value) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.faceSlot, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${mood.label} — ${mood.line}`}
        accessibilityState={{ selected: picked }}
        style={styles.faceHit}
      >
        {/* its own view, so the idle loop never fights the spring */}
        <Animated.View style={idleStyle}>
          <Face
            mood={mood.id}
            size={30}
            color={aimed ? colors.ink : mood.accent}
            cut={aimed ? mood.accent : "#101017"}
            animated={lively}
            delay={index * 0.13}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** The wheel itself: six wedges, the rim, the hole and the aim pointer. */
function Wheel({
  aimIndex,
  picked,
  active,
  cancelling,
  onPress,
}: {
  aimIndex: number;
  picked: MoodId | null;
  active: MoodId | null;
  cancelling: boolean;
  onPress: (mood: MoodId) => void;
}) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withSpring(1, { stiffness: 460, damping: 30 });
  }, [grow]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, grow.value * 1.4),
    transform: [{ scale: 0.5 + 0.5 * grow.value }, { rotate: `${-24 * (1 - grow.value)}deg` }],
  }));
  const h = CANVAS / 2;

  return (
    <Animated.View style={[styles.wheel, style]}>
      <Svg width={CANVAS} height={CANVAS} viewBox={`${-h} ${-h} ${CANVAS} ${CANVAS}`}>
        <Circle r={R_OUT + 3} fill="none" stroke={withAlpha(colors.text, 0.1)} strokeWidth={1} />
        {MOODS.map((m, i) => {
          const on = aimIndex === i;
          const off = wedgePoint(i, on ? POP : 0);
          const name = wedgePoint(i, FACE_R);
          const dot = wedgePoint(i, R_OUT - 9);
          return (
            <G key={m.id} x={off.x} y={off.y} onPress={() => onPress(m.id)}>
              <Path
                d={wedgePath(i, R_IN, R_OUT, GAP)}
                fill={on ? m.accent : "rgba(16,16,23,0.92)"}
                stroke={on ? m.accent : active === m.id ? withAlpha(m.accent, 0.7) : withAlpha(colors.text, 0.08)}
                strokeWidth={active === m.id && !on ? 1.5 : 1}
              />
              {picked === m.id && (
                // what you already said about this song: a dot on the rim
                <Circle cx={dot.x} cy={dot.y} r={3.5} fill={on ? colors.ink : m.accent} />
              )}
              <SvgText
                x={name.x}
                y={name.y + NAME_DY + 3}
                textAnchor="middle"
                fontFamily={fonts.bodyBold}
                fontSize={9}
                letterSpacing={0.9}
                fill={on ? "rgba(11,11,16,0.78)" : withAlpha(colors.text, 0.5)}
              >
                {m.label.toUpperCase()}
              </SvgText>
            </G>
          );
        })}
        <Circle
          r={R_IN - 6}
          fill="none"
          stroke={withAlpha(colors.text, 0.12)}
          strokeWidth={1}
          strokeDasharray="2 4"
        />
        {aimIndex >= 0 && (
          <Path d={wedgePath(aimIndex, R_IN - 7.5, R_IN - 4.5, 8)} fill={MOODS[aimIndex].accent} />
        )}
        {cancelling && (
          // back in the middle: this is where letting go cancels
          <Path
            d="M -7 -7 L 7 7 M 7 -7 L -7 7"
            stroke={withAlpha(colors.text, 0.7)}
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}
      </Svg>
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
  motionPref = "full",
  hint,
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
  motionPref?: "full" | "reduced" | "off";
  /** the line under everything; defaults to the card's "what are you in the mood for?" */
  hint?: string;
}) {
  const reach = R_OUT + POP + EDGE;
  const fx = origin.x - host.x;
  const fy = origin.y - host.y;
  const cx = Math.min(Math.max(fx, reach), host.width - reach);
  // kept clear of the hint strip: a ring opened low (the +, or a card's lower
  // edge) would otherwise put its bottom face on top of the hint text
  const cy = Math.min(Math.max(fy, reach + 40), host.height - reach - HINT_ROOM);

  // Back in the middle after pushing out is a change of mind: letting go
  // there closes the ring and picks nothing. Released without ever moving, it
  // stays up to be tapped. (A release ON a face is committed by the owner.)
  const everAimed = useRef(false);
  if (dragging && aim) everAimed.current = true;
  const wasDragging = useRef(dragging);
  useEffect(() => {
    if (wasDragging.current && !dragging && !aim && everAimed.current) onCancel();
    wasDragging.current = dragging;
  }, [dragging, aim, onCancel]);

  const aimIndex = aim ? MOODS.findIndex((m) => m.id === aim) : -1;
  const lead = aimIndex >= 0 ? MOODS[aimIndex] : null;
  const labelBelow = cy - R_OUT - 64 < 0;

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(120)}
        style={styles.backdrop}
      >
        {/* closes on touch-down, like the web's onPointerDown: a thumb that
            lands off the wheel means "not this", whether or not it then drags */}
        <Pressable style={StyleSheet.absoluteFill} onPressIn={onCancel} />
      </Animated.View>

      <View pointerEvents="box-none" style={[styles.ring, { left: cx, top: cy }]}>
        <Wheel
          aimIndex={aimIndex}
          picked={picked}
          active={active}
          cancelling={dragging && !aim && everAimed.current}
          onPress={onCommit}
        />
        {MOODS.map((m, i) => (
          <RingFace
            key={m.id}
            mood={m}
            index={i}
            aimed={aimIndex === i}
            picked={picked === m.id}
            lively={motionPref === "full"}
            onPress={() => onCommit(m.id)}
          />
        ))}
        <View
          pointerEvents="none"
          style={[
            styles.label,
            // anchored by the edge nearest the ring, so a two-line label grows
            // away from the faces instead of into the top one
            labelBelow ? { top: R_OUT + 16 } : { bottom: R_OUT + 16 },
          ]}
        >
          {lead ? (
            // one card for both lines — the description alone over busy
            // artwork was the hardest thing on screen to read
            <View style={styles.labelCard}>
              <Text style={[styles.labelCardTitle, { color: lead.accent }]}>{lead.label}</Text>
              <Text style={styles.labelCardLine} numberOfLines={1}>
                {lead.line}
              </Text>
            </View>
          ) : (
            <Text style={styles.labelLine}>
              {dragging
                ? everAimed.current
                  ? "let go here to cancel"
                  : "push toward a face"
                : "tap a face"}
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
            : (hint ?? "what are you in the mood for?")}
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
    // dark enough that the faces, not the album art, are what the eye finds
    backgroundColor: "rgba(3,3,5,0.72)",
  },
  // a point, not a box: everything is laid out around (0,0), the finger
  ring: { position: "absolute", width: 0, height: 0, zIndex: 31 },
  wheel: {
    position: "absolute",
    left: -CANVAS / 2,
    top: -CANVAS / 2,
    width: CANVAS,
    height: CANVAS,
  },
  faceSlot: { position: "absolute", left: 0, top: 0, width: FACE_BOX, height: FACE_BOX },
  faceHit: { width: FACE_BOX, height: FACE_BOX, alignItems: "center", justifyContent: "center" },
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
  // a solid pill: bare text over the dimmed tab bar read as one jumbled line
  hint: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 22,
    zIndex: 31,
    alignItems: "center",
  },
  hintText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(8,8,12,0.9)",
    borderWidth: 1,
    borderColor: withAlpha(colors.text, 0.12),
  },
  labelCard: {
    alignItems: "center",
    gap: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 7,
    borderRadius: 16,
    backgroundColor: "rgba(8,8,12,0.9)",
    borderWidth: 1,
    borderColor: withAlpha(colors.text, 0.12),
  },
  labelCardTitle: { fontFamily: fonts.displayBold, fontSize: 15 },
  labelCardLine: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
});
