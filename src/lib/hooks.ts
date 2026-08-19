import type { HookWindow, Track } from "../types";

/**
 * A song is played as a sequence of windows, not one block.
 *
 * The server sends them ordered best-first, so the strongest ten seconds is
 * what a listener hears when the card lands. Tracks with nothing marked fall
 * back to a single window covering whatever audio exists, which is what the
 * app did everywhere before hooks existed.
 */
const WHOLE: HookWindow = {
  id: "whole",
  startMs: 0,
  durationMs: Number.POSITIVE_INFINITY,
};

export function hooksOf(track: Track | null): HookWindow[] {
  if (!track) return [WHOLE];
  return track.hooks && track.hooks.length > 0 ? track.hooks : [WHOLE];
}

/** Full audio when the rights holder uploaded some, otherwise the preview. */
export function sourceOf(track: Track): string {
  return track.audioUrl || track.previewUrl;
}

/**
 * Seconds into the current window, and how long it runs.
 *
 * `duration` is the whole file, so an unmarked track's window has no length of
 * its own and borrows the file's — that is what keeps the scrub bar and the
 * countdown meaningful for both kinds of track.
 */
export function windowTiming(hook: HookWindow, currentTime: number, duration: number) {
  const startS = hook.startMs / 1000;
  const lengthS = Number.isFinite(hook.durationMs)
    ? hook.durationMs / 1000
    : Math.max(duration - startS, 0.001);
  const into = currentTime - startS;
  return {
    startS,
    lengthS,
    into,
    progress: Math.min(Math.max(into / lengthS, 0), 1),
    remaining: Math.max(lengthS - into, 0),
    done: into >= lengthS,
  };
}
