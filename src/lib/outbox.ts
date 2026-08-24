import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * A tiny write-ahead log for cloud mutations.
 *
 * Every swipe used to be fire-and-forget: offline or during a token blip the
 * mutation failed, `.catch(() => undefined)` ate it, and the action was gone
 * forever even though the local library still showed it. Now callers append
 * to this queue instead of dropping the error; a flusher drains it whenever
 * the app is foregrounded and signed in.
 *
 * Bounded on purpose — it's an outage buffer, not an email spool.
 */

const KEY = "hooked.outbox.v1";
const MAX_ITEMS = 200;

export type QueuedMutation =
  | { fn: "recordSwipe"; args: Record<string, unknown> }
  | { fn: "revertSwipe"; args: Record<string, unknown> }
  | { fn: "setSaveTarget"; args: Record<string, unknown> }
  | { fn: "removeSong"; args: Record<string, unknown> }
  | { fn: "unburyTrack"; args: Record<string, unknown> }
  | { fn: "unblockArtist"; args: Record<string, unknown> }
  | { fn: "setReplayContainer"; args: Record<string, unknown> }
  | { fn: "setTaste"; args: Record<string, unknown> }
  | { fn: "setPrefs"; args: Record<string, unknown> }
  | { fn: "deletePlaylist"; args: Record<string, unknown> };

export async function enqueue(item: QueuedMutation): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: QueuedMutation[] = raw ? JSON.parse(raw) : [];
    list.push(item);
    // newest wins when over budget — recent taste beats ancient swipes
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ITEMS)));
  } catch {
    // storage full/broken: nothing more we can do than drop the write
  }
}

/** Drain the queue through `send`, oldest first. Returns leftovers. */
export async function flush(
  send: (item: QueuedMutation) => Promise<unknown>,
): Promise<number> {
  let remaining = 0;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: QueuedMutation[] = raw ? JSON.parse(raw) : [];
    if (list.length === 0) return 0;
    const pending: QueuedMutation[] = [...list];
    const kept: QueuedMutation[] = [];
    while (pending.length > 0) {
      const item = pending[0];
      try {
        await send(item);
        pending.shift();
      } catch {
        // still failing (offline / rejected) — stop here, keep everything left
        break;
      }
    }
    kept.push(...pending);
    remaining = kept.length;
    await AsyncStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    remaining = -1;
  }
  return remaining;
}
