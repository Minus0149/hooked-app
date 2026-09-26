import { createContext, useContext, type RefObject } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { intensityForPx, tintOver } from "../lib/backdrop";

/**
 * The frosted layer behind the mood wheel and the sheets, matching the web's
 * `backdrop-filter: blur(...)` over a dark tint.
 *
 * Android only blurs what sits inside a BlurTargetView, so App wraps the
 * screen in one and hands its ref down through BlurTarget. Overlays are drawn
 * after that wrapper (the portal layer, the sheets), so the blur never has to
 * blur itself. Without a target — a component rendered somewhere else — the
 * Android backdrop is the plain dim, never a BlurView pointed at nothing.
 *
 * `dimezisBlurViewSdk31Plus` is real blur on Android 12+ and falls back to no
 * blur below it, where the library's own docs warn the blur is slow. Either
 * way the backdrop is only mounted while its overlay is open.
 */
export const BlurTarget = createContext<RefObject<View | null> | null>(null);

export function Backdrop({ blurPx, dim }: { blurPx: number; dim: number }) {
  const target = useContext(BlurTarget);
  const canBlur = Platform.OS !== "android" || target !== null;
  if (!canBlur) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(3,3,5,${dim})` }]} />;
  }
  const intensity = intensityForPx(blurPx);
  return (
    <>
      <BlurView
        style={StyleSheet.absoluteFill}
        tint="dark"
        intensity={intensity}
        blurTarget={target ?? undefined}
        blurMethod="dimezisBlurViewSdk31Plus"
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(3,3,5,${tintOver(dim, intensity).toFixed(3)})` },
        ]}
      />
    </>
  );
}
