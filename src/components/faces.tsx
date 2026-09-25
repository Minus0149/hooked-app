import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import type { MoodId } from "../data/mood";

/**
 * The six faces — a character each. The phone's copy of
 * web/src/components/faces.tsx: the same drawings (same 48-unit grid, same
 * paths), so a face looks the same on both.
 *
 * Web plays each face's loop with SMIL inside one SVG. react-native-svg has no
 * SMIL, so here every moving part is its own layer — its own <Svg> over the
 * same box — and reanimated moves the layer on the UI thread: hyped's brows
 * pump, party's hat rocks and confetti falls, sunny's rays turn and it blinks,
 * chill's note drifts off, tender's tear falls, sleepy breathes out its z's.
 */

type Spec = {
  /** keyframe times, 0..1, shared by every track below */
  at: number[];
  opacity?: number[];
  x?: number[];
  y?: number[];
  rotate?: number[];
  scaleX?: number[];
  scaleY?: number[];
};

/** One moving part: an overlay the size of the face, looping a Spec. */
function Part({
  size,
  color,
  on,
  dur,
  delay = 0,
  spec,
  origin = [24, 24],
  children,
}: {
  size: number;
  color: string;
  on: boolean;
  /** seconds per loop */
  dur: number;
  delay?: number;
  spec: Spec;
  /** the pivot, in the 48-unit grid */
  origin?: [number, number];
  children: ReactNode;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (!on) return;
    t.value = withDelay(
      delay * 1000,
      withRepeat(withTiming(1, { duration: dur * 1000, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(t);
  }, [on, dur, delay, t]);
  const k = size / 48;
  const style = useAnimatedStyle(() => {
    if (!on) return { opacity: 1, transform: [] };
    const v = (track: number[] | undefined, rest: number) =>
      track ? interpolate(t.value, spec.at, track) : rest;
    return {
      opacity: v(spec.opacity, 1),
      transform: [
        { translateX: v(spec.x, 0) * k },
        { translateY: v(spec.y, 0) * k },
        { rotate: `${v(spec.rotate, 0)}deg` },
        { scaleX: v(spec.scaleX, 1) },
        { scaleY: v(spec.scaleY, 1) },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { transformOrigin: [origin[0] * k, origin[1] * k, 0] }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 48 48" color={color}>
        {children}
      </Svg>
    </Animated.View>
  );
}

type DrawProps = { size: number; color: string; cut: string; on: boolean; delay: number };

const round = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const head = (
  <Circle cx="24" cy="26" r="17" fill="currentColor" fillOpacity={0.14} stroke="currentColor" strokeWidth="2.6" />
);
const fill = StyleSheet.absoluteFill;

/** Wide awake, brows up, shouting along — can't keep still. */
function Hyped({ size, color, cut, on, delay: d }: DrawProps) {
  const p = { size, color, on };
  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 48 48" color={color} style={fill}>
        {head}
        <Circle cx="17" cy="24" r="2.8" fill="currentColor" />
        <Circle cx="31" cy="24" r="2.8" fill="currentColor" />
        <Circle cx="18" cy="23" r="0.9" fill={cut} />
        <Circle cx="32" cy="23" r="0.9" fill={cut} />
      </Svg>
      <Part {...p} dur={0.8} delay={d} spec={{ at: [0, 0.2, 0.4, 1], opacity: [1, 0.15, 1, 1] }}>
        <Path d="M4.5 14 7.5 17.5 5 19.5 8.5 23" stroke="currentColor" strokeWidth="2.4" fill="none" {...round} />
      </Part>
      <Part {...p} dur={0.8} delay={d} spec={{ at: [0, 0.4, 0.6, 1], opacity: [1, 1, 0.15, 1] }}>
        <Path d="M43.5 14 40.5 17.5 43 19.5 39.5 23" stroke="currentColor" strokeWidth="2.4" fill="none" {...round} />
      </Part>
      <Part {...p} dur={0.55} delay={d} spec={{ at: [0, 0.5, 1], y: [0, -2.4, 0] }}>
        <G stroke="currentColor" strokeWidth="2.8" fill="none" {...round}>
          <Path d="M13.5 18.5q3.5-3.2 7 0" />
          <Path d="M27.5 18.5q3.5-3.2 7 0" />
        </G>
      </Part>
      <Part
        {...p}
        dur={0.55}
        delay={d}
        origin={[24, 32]}
        spec={{ at: [0, 0.5, 1], scaleX: [1, 1.08, 1], scaleY: [1, 1.25, 1] }}
      >
        <Path d="M16.5 30.2h15a7.5 7.5 0 0 1-15 0Z" fill="currentColor" />
      </Part>
    </>
  );
}

/** Eyes squeezed shut with glee, a hat that won't sit still, confetti. */
function Party({ size, color, cut, on, delay: d }: DrawProps) {
  const p = { size, color, on };
  const fall = (to: number): Spec => ({ at: [0, 0.5, 1], y: [0, to, 0], opacity: [0, 1, 0] });
  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 48 48" color={color} style={fill}>
        {head}
        <G stroke="currentColor" strokeWidth="2.6" fill="none" {...round}>
          <Path d="M13.8 24.5a3.6 3.6 0 0 1 6.2 0" />
          <Path d="M28 24.5a3.6 3.6 0 0 1 6.2 0" />
        </G>
        <Path d="M14.5 30h19a9.5 9.5 0 0 1-19 0Z" fill="currentColor" />
      </Svg>
      <Part {...p} dur={1} delay={d} origin={[30, 13]} spec={{ at: [0, 0.5, 1], rotate: [-10, 12, -10] }}>
        <G transform="translate(30 13) scale(.82)">
          <Path d="M-6.5 1.5 1.5 -12 6 3.5Z" fill="currentColor" />
          <Path d="M-3.4 -3.8 3.3 -2.2M-1 -8 3.6 -7" stroke={cut} strokeWidth="1.5" strokeLinecap="round" opacity={0.6} />
          <Circle cx="1.6" cy="-13.3" r="2.4" fill="currentColor" />
        </G>
      </Part>
      <Part {...p} dur={1.6} delay={d} spec={fall(10)}>
        <Rect x="5" y="4" width="3" height="3" rx="0.6" fill="currentColor" />
      </Part>
      <Part {...p} dur={1.9} delay={d + 0.5} spec={fall(12)}>
        <Circle cx="42" cy="4" r="1.6" fill="currentColor" />
      </Part>
      <Part {...p} dur={1.3} delay={d + 0.9} spec={fall(10)}>
        <Rect x="9" y="1" width="2.4" height="4" rx="0.6" fill="currentColor" />
      </Part>
    </>
  );
}

/** A little sun: turning rays, rosy cheeks, a blink now and then. */
function Sunny({ size, color, on, delay: d }: DrawProps) {
  const p = { size, color, on };
  return (
    <>
      <Part {...p} dur={14} delay={d} origin={[24, 26]} spec={{ at: [0, 1], rotate: [0, 360] }}>
        <G stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <Path key={a} d="M0 -20.5V-23.5" transform={`translate(24 26) rotate(${a})`} />
          ))}
        </G>
      </Part>
      <Svg width={size} height={size} viewBox="0 0 48 48" color={color} style={fill}>
        <Circle cx="24" cy="26" r="16" fill="currentColor" fillOpacity={0.14} stroke="currentColor" strokeWidth="2.6" />
        <Circle cx="14.5" cy="29.5" r="2.1" fill="currentColor" fillOpacity={0.35} />
        <Circle cx="33.5" cy="29.5" r="2.1" fill="currentColor" fillOpacity={0.35} />
        <Path d="M17 30a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </Svg>
      <Part {...p} dur={3.4} delay={d} origin={[24, 23.5]} spec={{ at: [0, 0.9, 0.95, 1], scaleY: [1, 1, 0.12, 1] }}>
        <Ellipse cx="18.5" cy="23.5" rx="2.3" ry="2.7" fill="currentColor" />
        <Ellipse cx="29.5" cy="23.5" rx="2.3" ry="2.7" fill="currentColor" />
      </Part>
    </>
  );
}

/** Shades on, half a smile, a note drifting off. */
function Chill({ size, color, cut, on, delay: d }: DrawProps) {
  const p = { size, color, on };
  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 48 48" color={color} style={fill}>
        {head}
        <G fill="currentColor">
          <Rect x="11" y="20" width="11" height="7" rx="3.2" />
          <Rect x="26" y="20" width="11" height="7" rx="3.2" />
          <Path d="M22 22.2h4" stroke="currentColor" strokeWidth="2" />
          <Path d="M11 21.5 7.5 20M37 21.5 40.5 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </G>
        <Path d="M18.5 33.5c3.5 1.8 7.5 1.6 11-.8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </Svg>
      <Part
        {...p}
        dur={3.2}
        delay={d}
        spec={{ at: [0, 0.7, 0.8, 0.85, 1], x: [0, 0, 8, 16, 16], opacity: on ? [0, 0, 0.8, 0, 0] : [0.7, 0.7, 0.7, 0.7, 0.7] }}
      >
        <Path d="M14 25.5 17 21.5" stroke={cut} strokeWidth="1.5" strokeLinecap="round" />
      </Part>
      <Part {...p} dur={2.8} delay={d} spec={{ at: [0, 0.5, 1], x: [0, 4, 6], y: [4, -1, -5], opacity: [0, 1, 0] }}>
        <Circle cx="39" cy="12" r="2" fill="currentColor" />
        <Path d="M40.8 12V5.5l3 1" fill="none" stroke="currentColor" strokeWidth="1.6" {...round} />
      </Part>
    </>
  );
}

/** Brows up in the middle, glassy eyes, a tear letting go. */
function Tender({ size, color, cut, on, delay: d }: DrawProps) {
  const p = { size, color, on };
  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 48 48" color={color} style={fill}>
        {head}
        <G stroke="currentColor" strokeWidth="2.4" fill="none" {...round}>
          <Path d="M13.5 19.5 19.5 17.5" />
          <Path d="M34.5 19.5 28.5 17.5" />
        </G>
        <Circle cx="18" cy="24.5" r="2.6" fill="currentColor" />
        <Circle cx="30" cy="24.5" r="2.6" fill="currentColor" />
        <Circle cx="18.9" cy="23.5" r="0.8" fill={cut} />
        <Circle cx="30.9" cy="23.5" r="0.8" fill={cut} />
        <Path d="M19 34.5a6.5 6.5 0 0 1 10 0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </Svg>
      <Part
        {...p}
        dur={2.6}
        delay={d}
        spec={{ at: [0, 0.3, 0.45, 0.75, 1], y: [-2, -2, -2, 4.7, 7], opacity: [0, 1, 1, 1, 0] }}
      >
        <Path d="M14.6 27.2c0 2.3-1.6 3-1.6 4.5a1.6 1.6 0 0 0 3.2 0c0-1.5-1.6-2.2-1.6-4.5Z" fill="currentColor" />
      </Part>
    </>
  );
}

/** Eyes shut, a slow breath, z's rising. */
function Sleepy({ size, color, on, delay: d }: DrawProps) {
  const p = { size, color, on };
  const zs: [number, number, number][] = [
    [33, 15, 5.2],
    [39.5, 8.5, 4],
    [44.5, 2.5, 3],
  ];
  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 48 48" color={color} style={fill}>
        {head}
        <G stroke="currentColor" strokeWidth="2.6" fill="none" {...round}>
          <Path d="M13.5 24.5a4 4 0 0 0 7 0" />
          <Path d="M27.5 24.5a4 4 0 0 0 7 0" />
        </G>
      </Svg>
      <Part
        {...p}
        dur={3}
        delay={d}
        origin={[24, 33]}
        spec={{ at: [0, 0.5, 1], scaleX: [1, 1.35, 1], scaleY: [1, 1.35, 1] }}
      >
        <Ellipse cx="24" cy="33" rx="2.4" ry="2" fill="currentColor" />
      </Part>
      {zs.map(([x, y, w], k) => (
        <Part
          key={k}
          {...p}
          dur={2.4}
          delay={d + k * 0.8}
          spec={{ at: [0, 0.5, 1], x: [-2, -0.5, 1], y: [3, 0.5, -2], opacity: [0, 1, 0] }}
        >
          <Path
            d={`M${x} ${y}h${w}l-${w} ${w}h${w}`}
            stroke="currentColor"
            strokeWidth={2.2 - k * 0.3}
            fill="none"
            {...round}
          />
        </Part>
      ))}
    </>
  );
}

const DRAWN: Record<MoodId, (props: DrawProps) => ReactNode> = {
  hyped: Hyped,
  party: Party,
  sunny: Sunny,
  chill: Chill,
  tender: Tender,
  sleepy: Sleepy,
};

export function Face({
  mood,
  size = 28,
  color = "#F4F2EE",
  cut = "#0B0B10",
  animated = false,
  delay = 0,
}: {
  mood: MoodId;
  size?: number;
  color?: string;
  /** the colour behind the face, for its cut-outs (a glint, an eye's highlight) */
  cut?: string;
  /** play the face's loop (the in-app motion setting is "full") */
  animated?: boolean;
  /** seconds, so a row of faces doesn't move in unison */
  delay?: number;
  /** kept for older callers; the faces have their own weights */
  strokeWidth?: number;
}) {
  const Drawn = DRAWN[mood];
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Drawn size={size} color={color} cut={cut} on={animated} delay={delay} />
    </View>
  );
}
