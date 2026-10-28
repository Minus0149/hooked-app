import type { HookWindow, Track } from "../types";
import { distinctHooks, hookGain, hookTiming } from "./hookPlayback";

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

/** How often the player's volume follows the fade (ms). Status events (250 ms) are too coarse for a 0.5 s fade. */
export const FADE_TICK_MS = 40;

/**
 * The player's volume at this moment of a window: the listener's own volume
 * is the ceiling, times hookGain's short fade-in at the window's start and its
 * fade over the last FADE_OUT_S, so a hook ends gently instead of stopping dead
 * where the line ends (the web player does the same, lib/hookPlayback.ts).
 *
 * `endsHere` is false when the song carries on past this window (Auto-advance
 * off, on the last window): then only the fade-in applies, because fading out
 * there would leave the song "playing" in silence.
 */
export function windowVolume(
  hook: HookWindow,
  currentTime: number,
  duration: number,
  ceiling: number,
  endsHere = true,
): number {
  const top = Number.isFinite(ceiling) ? Math.min(Math.max(ceiling, 0), 1) : 1;
  const t = hookTiming(hook, currentTime, duration);
  return top * hookGain(t.into, endsHere ? t.lengthS : Number.POSITIVE_INFINITY);
}
