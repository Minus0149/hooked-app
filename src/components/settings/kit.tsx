import { useEffect, type ReactNode } from "react";
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
    transform: [{ translateX: v.value * 17 }],
  }));

  return (
    <Animated.View style={[styles.toggle, trackStyle]}>
      <Animated.View style={[styles.toggleKnob, knobStyle]} />
    </Animated.View>
  );
}

export function Row({
  icon,
  iconColor,
  label,
  labelColor,
  sub,
  right,
  chevron,
  onPress,
}: {
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  label: string;
  labelColor?: string;
  sub?: string;
  right?: ReactNode;
  chevron?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
    >
      {icon && (
        <View style={styles.rowIcon}>
          <Feather name={icon} size={17} color={iconColor ?? colors.text} />
        </View>
      )}
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
  rowIcon: { width: 24, alignItems: "center" },
  rowLabelWrap: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.text },
  rowSub: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  rowValue: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.muted },
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
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.text },
});
