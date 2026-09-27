import type { HookWindow, Track } from "../types";
import { distinctHooks, hookTiming } from "./hookPlayback";

/**
 * A song is played as a sequence of windows, not one block.
 *
 * The server sends them ordered best-first. Since hook recognition v3 a
 * preview carries one window (the hook to the end of the audio) and a full
 * upload up to three distinct sections; distinctHooks drops any window that
 * would replay seconds already heard. Tracks with nothing marked fall back to
 * a single window covering whatever audio exists.
 */
const WHOLE: HookWindow = {
  id: "whole",
  startMs: 0,
  durationMs: Number.POSITIVE_INFINITY,
};

export function hooksOf(track: Track | null): HookWindow[] {
  if (!track) return [WHOLE];
  const list = track.hooks && track.hooks.length > 0 ? distinctHooks(track.hooks) : [];
  return list.length > 0 ? list : [WHOLE];
}

/** Full audio when the rights holder uploaded some, otherwise the preview. */
export function sourceOf(track: Track): string {
  return track.audioUrl || track.previewUrl;
}

/**
 * Seconds into the current window, and how long it runs — cut at the end of
 * the file, and borrowed from it for the open-ended fallback. The rules live
 * in hookPlayback.ts, shared with the web player.
 */
export function windowTiming(hook: HookWindow, currentTime: number, duration: number) {
  return hookTiming(hook, currentTime, duration);
}
