import { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { FACE_IDLE, faceIdleTiming, type MoodId } from "../data/mood";

/**
 * A face's idle loop in the ring, on the UI thread. The keyframes come from
 * data/mood.ts — the same table the web ring plays — and each list starts and
 * ends on the same value, so a 0→1 clock repeated forever loops seamlessly.
 * Off (a still face) unless the in-app motion setting is "full".
 */
export function useFaceIdle(mood: MoodId, index: number, aimed: boolean, enabled: boolean) {
  const t = useSharedValue(0);
  const idle = FACE_IDLE[mood];

  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (!enabled) return;
    const { duration, delay } = faceIdleTiming(index, aimed, idle.duration);
    t.value = withDelay(
      delay * 1000,
      withRepeat(
        withTiming(1, { duration: duration * 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(t);
  }, [enabled, aimed, index, idle.duration, t]);

  const frames = idle.keyframes;
  return useAnimatedStyle(() => {
    const at = (list: number[] | undefined, rest: number) => {
      if (!list || list.length < 2) return rest;
      const points = list.map((_, i) => i / (list.length - 1));
      return interpolate(t.value, points, list);
    };
    return {
      transform: [
        { translateX: at(frames.x, 0) },
        { translateY: at(frames.y, 0) },
        { rotate: `${at(frames.rotate, 0)}deg` },
        { scale: at(frames.scale, 1) },
      ],
    };
  });
}
