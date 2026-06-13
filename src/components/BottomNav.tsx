import { useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, withAlpha } from "../design/tokens";

export type NavView = "home" | "discover";

const FAB = 58;
const NOTCH_R = 33; // notch circle radius
const FILLET = 9; // shoulder radius — the "water droplet" outward swell
const DIP = 5; // notch circle center sits this far below the bar's top edge
const OVER = 12; // how far the droplet shoulders rise above the bar's edge

/**
 * Bar silhouette as one SVG path: the top edge SWELLS OUTWARD (upward)
 * through convex shoulder arcs before wrapping around the notch — a true
 * water-droplet profile, symmetric by construction. Mirrors web's barPath().
 */
function barPath(w: number, h: number, notch: boolean): string {
  const R = h / 2;
  if (!notch) {
    return `M ${R} 0.5 H ${w - R} A ${R - 0.5} ${R - 0.5} 0 0 1 ${w - R} ${h - 0.5} H ${R} A ${R - 0.5} ${R - 0.5} 0 0 1 ${R} 0.5 Z`;
  }
  const cx = w / 2;
  const xf = Math.sqrt((NOTCH_R + FILLET) ** 2 - (DIP + FILLET) ** 2);
  const k = NOTCH_R / (NOTCH_R + FILLET);
  const tx = xf * k;
  const ty = DIP + (-FILLET - DIP) * k;
  return [
    `M ${R} 0.5`,
    `H ${cx - xf}`,
    `A ${FILLET} ${FILLET} 0 0 0 ${cx - tx} ${ty}`, // shoulder swells outward
    `A ${NOTCH_R} ${NOTCH_R} 0 1 0 ${cx + tx} ${ty}`, // around the button
    `A ${FILLET} ${FILLET} 0 0 0 ${cx + xf} 0.5`, // and back down to the edge
    `H ${w - R}`,
    `A ${R - 0.5} ${R - 0.5} 0 0 1 ${w - R} ${h - 0.5}`,
    `H ${R}`,
    `A ${R - 0.5} ${R - 0.5} 0 0 1 ${R} 0.5`,
    `Z`,
  ].join(" ");
}

function NavButton({
  icon,
  label,
  active,
  accent,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.8 }]}
      onPress={onPress}
    >
      <Feather name={icon} size={22} color={active ? accent : colors.muted} />
      <Text style={[styles.navLabel, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function BottomNav({
  view,
  accent,
  showCreate,
  onChange,
  onCreate,
}: {
  view: NavView;
  accent: string;
  showCreate: boolean; // the + (and its notch) only live on the home screen
  onChange: (v: NavView) => void;
  onCreate: () => void;
}) {
  const v = useSharedValue(showCreate ? 1 : 0);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    v.value = withSpring(showCreate ? 1 : 0, { stiffness: 420, damping: 26 });
  }, [showCreate]);

  const fabStyle = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * 18 }, { scale: Math.max(v.value, 0) }],
  }));

  const onBarLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDims({ w: Math.round(width), h: Math.round(height) });
  };

  return (
    <View style={styles.dock}>
      <View style={styles.bar} onLayout={onBarLayout}>
        {dims && (
          <Svg
            pointerEvents="none"
            style={{ position: "absolute", top: -OVER, left: 0 }}
            width={dims.w}
            height={dims.h + OVER}
            viewBox={`0 ${-OVER} ${dims.w} ${dims.h + OVER}`}
          >
            <Path
              d={barPath(dims.w, dims.h, showCreate)}
              fill={withAlpha(colors.surface, 0.96)}
              stroke={colors.line}
              strokeWidth={1}
            />
          </Svg>
        )}
        <NavButton
          icon="home"
          label="Home"
          active={view === "home"}
          accent={accent}
          onPress={() => onChange("home")}
        />
        {/* fixed-width slot keeps the tabs apart under the notch */}
        <View style={styles.fabSlot} />
        <NavButton
          icon="compass"
          label="Discover"
          active={view === "discover"}
          accent={accent}
          onPress={() => onChange("discover")}
        />
        {/* lives INSIDE the bar so the + and the notch share one center */}
        <Animated.View
          pointerEvents={showCreate ? "box-none" : "none"}
          style={[styles.fabHost, fabStyle]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: accent },
              pressed && { transform: [{ scale: 0.9 }] },
            ]}
            onPress={onCreate}
          >
            <Feather name="plus" size={26} color={colors.ink} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    marginHorizontal: 18,
    marginTop: 6,
    // root SafeAreaView already pads the bottom inset, so this lands at
    // safe-area + 14 like web's calc(14px + env(safe-area-inset-bottom))
    marginBottom: 14,
  },
  // the SVG path draws the bar's fill/border; the View is just layout
  bar: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  navBtn: {
    width: 92,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 8,
    paddingBottom: 7,
  },
  navLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 0.2,
    color: colors.muted,
  },
  fabSlot: { width: 66, flexShrink: 0 },
  // host spans the bar so the FAB is flex-centered, never math-centered;
  // the button nests into the droplet notch
  fabHost: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -24,
    alignItems: "center",
  },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
