import { createContext, useContext, useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radii } from "../../design/tokens";

/** Animated track+knob switch matching web's .toggle — save-green when on. */
export function Toggle({ on }: { on: boolean }) {
  const v = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    v.value = withTiming(on ? 1 : 0, { duration: 200 });
  }, [on]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [colors.surface2, colors.save]),
    borderColor: interpolateColor(v.value, [0, 1], [colors.line, colors.save]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: v.value * 19 }],
  }));

  return (
    <Animated.View style={[styles.toggle, trackStyle]}>
      <Animated.View style={[styles.toggleKnob, knobStyle]} />
    </Animated.View>
  );
}

/**
 * A card of rows with hairlines between them — settings reads as a few short
 * groups instead of one long column of separate boxes (mirrors web's
 * .settings-card).
 */
const InGroup = createContext(false);
export function RowGroup({ children }: { children: ReactNode }) {
  return (
    <View style={styles.card}>
      {/* the first row's top hairline is tucked under the card's edge */}
      <View style={{ marginTop: -StyleSheet.hairlineWidth }}>
        <InGroup.Provider value={true}>{children}</InGroup.Provider>
      </View>
    </View>
  );
}

/**
 * The icon slot at a row's left: a text symbol when given one (what the web
 * draws in .settings-row-icon, so the two apps show the same marks), else a
 * Feather icon, else nothing.
 */
function RowIcon({
  icon,
  glyph,
  color,
}: {
  icon?: keyof typeof Feather.glyphMap;
  glyph?: string;
  color?: string;
}) {
  if (!glyph && !icon) return null;
  return (
    <View style={styles.rowIcon}>
      {glyph ? (
        <Text style={[styles.rowGlyph, { color: color ?? colors.text }]}>{glyph}</Text>
      ) : (
        <Feather name={icon!} size={17} color={color ?? colors.text} />
      )}
    </View>
  );
}

export function Row({
  icon,
  glyph,
  iconColor,
  label,
  labelColor,
  sub,
  right,
  chevron,
  onPress,
}: {
  icon?: keyof typeof Feather.glyphMap;
  /** a text symbol instead of an icon — web's settings rows use these (↓ ↻ § ✕ ♥ …) */
  glyph?: string;
  iconColor?: string;
  label: string;
  labelColor?: string;
  sub?: string;
  right?: ReactNode;
  chevron?: boolean;
  /** absent: an information row that isn't a button */
  onPress?: () => void;
}) {
  const grouped = useContext(InGroup);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, grouped && styles.rowGrouped, pressed && { opacity: 0.8 }]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
    >
      <RowIcon icon={icon} glyph={glyph} color={iconColor} />
      <View style={styles.rowLabelWrap}>
        <Text style={[styles.rowLabel, labelColor != null && { color: labelColor }]}>
          {label}
        </Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right}
      {chevron && <Feather name="chevron-right" size={16} color={colors.muted} />}
    </Pressable>
  );
}

/** Exclusive option picker rendered as pill chips. */
export function Segmented<T extends string>({
  options,
  value,
  accent,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  accent?: string;
  onChange: (id: T) => void;
}) {
  return (
    <View style={segStyles.wrap}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[
              segStyles.chip,
              on && { backgroundColor: accent ?? colors.accentDefault, borderColor: accent ?? colors.accentDefault },
            ]}
          >
            <Text style={[segStyles.label, on && { color: colors.ink }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.group}>{children}</Text>;
}

/**
 * A row that isn't a button — it carries its own control on the right (a
 * slider), like web's `div.settings-row` for Volume and Swipe distance.
 */
export function StaticRow({
  icon,
  glyph,
  iconColor,
  label,
  sub,
  right,
}: {
  icon?: keyof typeof Feather.glyphMap;
  /** a text symbol instead of an icon — web's settings rows use these (↓ ↻ § ✕ ♥ …) */
  glyph?: string;
  iconColor?: string;
  label: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.row} accessibilityLabel={sub ? `${label}. ${sub}` : label}>
      <RowIcon icon={icon} glyph={glyph} color={iconColor} />
      <View style={styles.rowLabelWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** The quiet word at a row's right edge — "save", "open", "change" (web .settings-row-value). */
export function RowValue({ children, color }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.rowValue, color != null && { color }]}>{children}</Text>;
}

/**
 * A labelled card holding one setting's controls, with an optional hint under
 * them — web's `.prefs-block`, used on every settings sub-page.
 */
export function Block({
  label,
  hint,
  children,
  style,
}: {
  label?: string;
  hint?: ReactNode;
  children?: ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.block, style]}>
      {label ? <Text style={styles.blockLabel}>{label}</Text> : null}
      {children}
      {hint ? <Text style={styles.blockHint}>{hint}</Text> : null}
    </View>
  );
}

/** A hint line outside any card (web `.prefs-hint`). */
export function Hint({ children }: { children: ReactNode }) {
  return <Text style={styles.hintLine}>{children}</Text>;
}

/** A bare label above chips that sit outside a card (web `.prefs-label`). */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={[styles.blockLabel, { marginTop: 14, marginBottom: 8 }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  group: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 18,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  rowGrouped: {
    marginBottom: 0,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  card: {
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    marginBottom: 4,
  },
  rowIcon: { width: 24, alignItems: "center" },
  rowGlyph: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 19, textAlign: "center" },
  rowLabelWrap: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  rowSub: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  rowValue: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.muted },
  block: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  blockLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 2,
  },
  blockHint: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.muted },
  hintLine: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.muted,
    marginBottom: 10,
  },
  toggle: {
    width: 42,
    height: 25,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 19,
    height: 19,
    borderRadius: 999,
    marginLeft: 2,
    backgroundColor: "#FFFFFF",
  },
});

const segStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
});


