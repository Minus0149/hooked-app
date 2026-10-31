/**
 * Shared playlists the server stopped listing for this listener: they joined
 * it through an invite, and since then the owner removed them, turned off both
 * Public and Collaborative (which takes every member out), or a block between
 * the two ended it. Those leave the phone too.
 *
 * `joinedBefore` is the last library's playlists that belonged to someone
 * else; `listedNow` is every playlist id in the current library. Playlists the
 * listener owns never appear in `joinedBefore`, so an unsynced one made on
 * this device is never dropped.
 */
export function droppedShared(joinedBefore: Iterable<string>, listedNow: Set<string>): string[] {
  const out: string[] = [];
  for (const id of joinedBefore) if (!listedNow.has(id)) out.push(id);
  return out;
}
