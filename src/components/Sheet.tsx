import { useCallback, useEffect, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors, fonts } from "../design/tokens";

/**
 * Bottom sheet chrome shared by the save-target / new-playlist / full-song
 * sheets — animated translateY card over a fading backdrop, matching web's
 * .sheet / .sheet-backdrop. Children get the animated `close` so option taps
 * can dismiss with the slide-out instead of unmounting instantly.
 *
 * The off-screen park position is derived from the real window height: the
 * old fixed 620px was shorter than tall sheets on big phones, so the card
 * visibly popped into place instead of sliding.
 */
export function Sheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const { height: WINDOW_H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const offY = WINDOW_H; // fully below anything visible
  const ty = useSharedValue(offY);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(1, { duration: 200 });
    ty.value = withSpring(0, { stiffness: 380, damping: 34 });
  }, []);

  const close = useCallback(() => {
    fade.value = withTiming(0, { duration: 200 });
    ty.value = withTiming(offY, { duration: 230, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  return (
    <KeyboardAvoidingView
      style={StyleSheet.absoluteFill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityLabel="close"
        />
      </Animated.View>
      <Animated.View style={[styles.card, { marginBottom: Math.max(insets.bottom, 12) }, cardStyle]}>
        {children(close)}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.backdrop,
  },
  card: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
  },
});

// shared typography for sheet headers, used by every sheet
export const sheetText = StyleSheet.create({
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 6,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.muted,
    marginBottom: 18,
  },
});
