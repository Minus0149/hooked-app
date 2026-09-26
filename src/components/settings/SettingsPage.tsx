import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors, fonts, radii } from "../../design/tokens";

/**
 * Chrome for a Settings sub-page, laid out like web's PageShell: back button
 * and the wordmark in the bar, then the page's title large on the left with
 * its one-line description, then the rows — in a scroll view. Exists so "deeper navigation" is one `push("settings:x")`
 * away instead of another flat column — every page gets its own stack entry,
 * so Android hardware back walks out of it naturally.
 */
export function SettingsPage({
  title,
  sub,
  onBack,
  children,
}: {
  title: string;
  sub?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable
          style={({ pressed }) => [styles.topBtn, pressed && { transform: [{ scale: 0.92 }] }]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="back to settings"
        >
          <Feather name="corner-up-left" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.wordmark}>
          hookedcue<Text style={{ color: colors.accentDefault }}>.</Text>
        </Text>
        <View style={{ width: 42, height: 42 }} />
      </View>
      <Animated.ScrollView
        entering={FadeInDown.springify().stiffness(300).damping(30)}
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        {children}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.text,
    marginBottom: 6,
  },
  topBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 4 },
  sub: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginBottom: 16,
  },
});
