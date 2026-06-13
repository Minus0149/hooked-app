import { useCallback, useEffect, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors, fonts } from "../design/tokens";

const OFF_Y = 620; // safely below any phone's sheet height

/**
 * Bottom sheet chrome shared by the save-target / new-playlist / full-song
 * sheets — animated translateY card over a fading backdrop, matching web's
 * .sheet / .sheet-backdrop. Children get the animated `close` so option taps
 * can dismiss with the slide-out instead of unmounting instantly.
 */
export function Sheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const ty = useSharedValue(OFF_Y);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(1, { duration: 200 });
    ty.value = withSpring(0, { stiffness: 380, damping: 34 });
  }, []);

  const close = useCallback(() => {
    fade.value = withTiming(0, { duration: 200 });
    ty.value = withTiming(OFF_Y, { duration: 230 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
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
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View style={[styles.card, cardStyle]}>
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
    bottom: 12,
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
