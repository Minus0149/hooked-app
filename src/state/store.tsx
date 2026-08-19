import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Playlist, SaveTarget, SwipeAction, Track } from "../types";
import catalogJson from "../data/catalog.json";

/**
 * Songs shipped inside the app binary. They are the offline deck and what a
 * cold start plays; the real catalogue lives in Convex and replaces this as
 * soon as tracks.list answers, which is also the only way hooks, creator
 * uploads and imported songs ever reach a card.
 */
const BAKED = catalogJson as Track[];
const PERSIST_KEY = "hooked.library.v2";
const LEGACY_KEY = "hooked.library.v1";

export interface HistoryEntry {
  track: Track;
  action: SwipeAction;
  // true only when a "save" actually added the track to the library —
  // re-liking an already-saved song must not remove it on revert
  savedToLibrary?: boolean;
}

export interface AppState {
  queue: Track[]; // queue[0] is the track on deck
  history: HistoryEntry[];
  liked: Track[];
  discoveries: Track[];
  playlists: Playlist[];
  neverArtists: string[];
  boostGenres: string[];
  saveTarget: SaveTarget;
  autoAdvance: boolean; // keep playing the next song when a preview ends
  hydrated: boolean;
  // every track the deck may deal, carrying its hooks. Starts as the baked
  // list and is replaced by the server's.
  catalog: Track[];
  // ids the server still serves; null until tracks.list has answered
  allowedIds: string[] | null;
  // songs buried with a left swipe; never re-dealt, ever
  neverTracks: string[];
  // containers whose songs may come round again ("liked" | "discoveries" | "pl:<id>")
  replayContainers: string[];
}

type Persisted = Partial<
  Pick<
    AppState,
    | "liked"
    | "discoveries"
    | "playlists"
    | "neverArtists"
    | "saveTarget"
    | "boostGenres"
    | "autoAdvance"
  >
>;

type Action =
  | { type: "SWIPE"; action: SwipeAction }
  | { type: "BACK" }
  | { type: "JUMP_TO"; trackId: string }
  | { type: "SET_SAVE_TARGET"; target: SaveTarget }
  | { type: "SET_AUTO_ADVANCE"; value: boolean }
  | { type: "SET_REPLAY"; container: string; allow: boolean }
  | { type: "CREATE_PLAYLIST"; playlist: Playlist }
  | { type: "DELETE_PLAYLIST"; id: string }
  | { type: "REMOVE_SONG"; trackId: string }
  | { type: "HYDRATE"; payload: Persisted }
  | {
      // replaces the local library with the signed-in user's cloud library
      type: "HYDRATE_REMOTE";
      liked: Track[];
      discoveries: Track[];
      playlists: Playlist[];
      neverArtists: string[];
      neverTracks: string[];
      replayContainers: string[];
      saveTarget: SaveTarget;
    }
  | {
      // the server catalogue arrived: it replaces the baked one wholesale,
      // which is what brings hooks and creator tracks into the deck
      type: "APPLY_CATALOG";
      tracks: Track[];
    }
  | { type: "RESET" };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQueue(catalog: Track[], exclude: Set<string>, neverArtists: string[]): Track[] {
  const fresh = catalog.filter(
    (t) => !exclude.has(t.id) && !neverArtists.includes(t.artist),
  );
  // If the user has heard everything, loop the catalog rather than dead-ending
  const pool =
    fresh.length > 4 ? fresh : catalog.filter((t) => !neverArtists.includes(t.artist));
  return shuffle(pool);
}

/**
 * Everything the deck must not deal again.
 *
 * Buried songs are absolute. Saved songs are excluded per container, because
 * "I saved this" usually means "stop showing me it" but not always — a playlist
 * someone treats as a rotation should keep coming round.
 */
function blockedIds(
  state: Pick<
    AppState,
    "liked" | "discoveries" | "playlists" | "neverTracks" | "replayContainers"
  >,
): Set<string> {
  const allow = new Set(state.replayContainers);
  const blocked = new Set(state.neverTracks);
  if (!allow.has("liked")) for (const t of state.liked) blocked.add(t.id);
  if (!allow.has("discoveries")) for (const t of state.discoveries) blocked.add(t.id);
  for (const p of state.playlists) {
    if (allow.has(`pl:${p.id}`)) continue;
    for (const t of p.tracks) blocked.add(t.id);
  }
  return blocked;
}

function libraryIds(state: Pick<AppState, "liked" | "discoveries" | "playlists">) {
  return new Set(
    [
      ...state.liked,
      ...state.discoveries,
      ...state.playlists.flatMap((p) => p.tracks),
    ].map((t) => t.id),
  );
}

/**
 * Queue invariant: every track id appears at most once. Duplicate ids break
 * React's keyed card stack ("two children with the same key") which renders
 * as duplicated/stale card images — this guard makes that impossible.
 */
function uniqueById(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/**
 * Many catalog tracks share one album's artwork. Two of those back-to-back
 * look like "the card didn't change" even when everything works — push
 * same-artwork neighbors apart. Never moves index 0 (the visible card).
 */
function spreadAlbums(tracks: Track[]): Track[] {
  const out = [...tracks];
  for (let i = 1; i < out.length; i++) {
    if (out[i].artwork === out[i - 1].artwork) {
      const j = out.findIndex((t, k) => k > i && t.artwork !== out[i - 1].artwork);
      if (j > i) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

const initialState: AppState = {
  catalog: BAKED,
  allowedIds: null,
  neverTracks: [],
  replayContainers: [],
  queue: buildQueue(BAKED, new Set(), []),
  history: [],
  liked: [],
  discoveries: [],
  playlists: [],
  neverArtists: [],
  boostGenres: [],
  saveTarget: "liked",
  autoAdvance: true,
  hydrated: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE": {
      // never clobber state that's already hydrated (e.g. the cloud library
      // landing before the slower-than-usual local read)
      if (state.hydrated) return state;
      const merged: AppState = {
        ...state,
        liked: uniqueById(action.payload.liked ?? []),
        discoveries: uniqueById(action.payload.discoveries ?? []),
        playlists: (action.payload.playlists ?? []).map((p) => ({
          ...p,
          tracks: uniqueById(p.tracks),
        })),
        neverArtists: action.payload.neverArtists ?? [],
        boostGenres: action.payload.boostGenres ?? [],
        saveTarget: action.payload.saveTarget ?? "liked",
        autoAdvance: action.payload.autoAdvance ?? true,
        hydrated: true,
      };
      const inLibrary = libraryIds(merged);
      return {
        ...merged,
        queue: spreadAlbums(buildQueue(state.catalog, inLibrary, merged.neverArtists)),
      };
    }

    case "HYDRATE_REMOTE": {
      const inLibrary = blockedIds(action);
      // keep the card the user is looking at — yanking queue[0] mid-session
      // swaps the visible card/audio under their thumb
      const [head, ...restQ] = state.queue;
      let queue = [
        ...(head ? [head] : []),
        ...restQ.filter(
          (t) => !inLibrary.has(t.id) && !action.neverArtists.includes(t.artist),
        ),
      ];
      // filter-only hydration could leave the deck thin or permanently EMPTY
      // (SWIPE's refill is unreachable with an empty queue) — top it up here
      if (queue.length < 3) {
        const queued = new Set(queue.map((t) => t.id));
        const fresh = state.catalog.filter(
          (t) =>
            !inLibrary.has(t.id) &&
            !action.neverArtists.includes(t.artist) &&
            !queued.has(t.id),
        );
        // the relaxed pool gives up on freshness, never on what they buried
        const fallback = state.catalog.filter(
          (t) =>
            !action.neverTracks.includes(t.id) &&
            !action.neverArtists.includes(t.artist) &&
            !queued.has(t.id),
        );
        queue = [...queue, ...shuffle(fresh.length >= 3 ? fresh : fallback)];
      }
      return {
        ...state,
        liked: uniqueById(action.liked),
        discoveries: uniqueById(action.discoveries),
        playlists: action.playlists.map((p) => ({ ...p, tracks: uniqueById(p.tracks) })),
        neverArtists: action.neverArtists,
        neverTracks: action.neverTracks,
        replayContainers: action.replayContainers,
        saveTarget: action.saveTarget,
        queue: spreadAlbums(uniqueById(queue)),
        hydrated: true,
        // keep history: clearing it killed the ↩ button at every sign-in
      };
    }

    case "APPLY_CATALOG": {
      const ids = action.tracks.map((t) => t.id);
      // tracks.list is reactive; returning a fresh object on every re-fire
      // would feed the render loop. Same ids in the same order means no work.
      const sameIds =
        state.allowedIds !== null &&
        state.allowedIds.length === ids.length &&
        state.allowedIds.every((id, i) => id === ids[i]);
      if (sameIds) return state;

      // Keep the card being looked at if the server still carries it, and
      // rebuild the rest. Filtering the old queue instead would empty the deck
      // whenever the server list isn't a superset of the baked one.
      const head = state.queue[0];
      const allowed = new Set(ids);
      const keepHead = head && allowed.has(head.id) ? head : null;
      const exclude = libraryIds(state);
      if (keepHead) exclude.add(keepHead.id);

      const rest = buildQueue(action.tracks, exclude, state.neverArtists);
      return {
        ...state,
        catalog: action.tracks,
        allowedIds: ids,
        queue: spreadAlbums(uniqueById(keepHead ? [keepHead, ...rest] : rest)),
      };
    }

    case "RESET":
      return {
        ...initialState,
        // a reset clears the user's data, not the catalogue we already fetched
        catalog: state.catalog,
        allowedIds: state.allowedIds,
        queue: buildQueue(state.catalog, new Set(), []),
        hydrated: true,
      };

    case "SWIPE": {
      const current = state.queue[0];
      if (!current) return state;
      let rest = state.queue.slice(1);
      let { liked, discoveries, playlists, neverArtists, neverTracks, boostGenres } = state;

      const savedToLibrary =
        action.action === "save" && !libraryIds(state).has(current.id);
      if (savedToLibrary) {
        if (state.saveTarget === "liked") {
          liked = [current, ...liked];
        } else if (state.saveTarget === "discoveries") {
          discoveries = [current, ...discoveries];
        } else {
          const plId = state.saveTarget.slice(3);
          const found = playlists.some((p) => p.id === plId);
          if (found) {
            playlists = playlists.map((p) =>
              p.id === plId ? { ...p, tracks: [current, ...p.tracks] } : p,
            );
          } else {
            liked = [current, ...liked]; // target playlist vanished — fall back
          }
        }
      }
      if (action.action === "more") {
        // keep the visible peek card in place — re-ranking the card the user
        // can already see reads as photos jumping around
        const [peek, ...tail] = rest;
        const similar = tail.filter(
          (t) => t.genre === current.genre || t.artist === current.artist,
        );
        const others = tail.filter(
          (t) => t.genre !== current.genre && t.artist !== current.artist,
        );
        rest = peek
          ? [peek, ...shuffle(similar), ...others]
          : [...shuffle(similar), ...others];
        boostGenres = [
          current.genre,
          ...boostGenres.filter((g) => g !== current.genre),
        ].slice(0, 3);
      }
      if (action.action === "never") {
        neverArtists = neverArtists.includes(current.artist)
          ? neverArtists
          : [...neverArtists, current.artist];
        // bury the song too. The artist block is the broader promise and can be
        // lifted; "never play this one again" should survive that.
        neverTracks = neverTracks.includes(current.id)
          ? neverTracks
          : [...neverTracks, current.id];
        rest = rest.filter((t) => t.artist !== current.artist);
      }
      // top up BEFORE the queue runs dry (the deck shows 3 cards), and never
      // refill with the just-swiped track, anything already queued, or
      // recently seen songs — re-dealing the same card right back was the
      // "old image appears again" glitch (and, with ↩, duplicate queue ids)
      if (rest.length < 3) {
        const blocked = blockedIds({
          liked,
          discoveries,
          playlists,
          neverTracks,
          replayContainers: state.replayContainers,
        });
        const avoid = new Set([
          current.id,
          ...rest.map((t) => t.id),
          ...state.history.slice(-12).map((h) => h.track.id),
        ]);
        // Never reach for a song the listener buried or already keeps. The old
        // fallbacks dropped that filter when fresh material ran short, which is
        // why saved songs came back. Running low relaxes *recency*, not this.
        const pickable = state.catalog.filter(
          (t) => !blocked.has(t.id) && !neverArtists.includes(t.artist),
        );
        const fresh = pickable.filter((t) => !avoid.has(t.id));
        const pool = fresh.length >= 3 ? fresh : pickable.filter((t) => t.id !== current.id);
        rest = [...rest, ...shuffle(pool)];
      }
      return {
        ...state,
        queue: spreadAlbums(uniqueById(rest)),
        history: [
          ...state.history,
          { track: current, action: action.action, savedToLibrary },
        ].slice(-50),
        liked,
        discoveries,
        playlists,
        neverArtists,
        neverTracks,
        boostGenres,
      };
    }

    case "BACK": {
      const last = state.history[state.history.length - 1];
      if (!last) return state;
      let { liked, discoveries, playlists, neverArtists } = state;
      // Going back also reverts what the swipe did, so the user can re-decide —
      // but only if that save actually added the track (a re-like of an
      // already-saved song must not strip it from the library)
      if (last.action === "save" && last.savedToLibrary) {
        liked = liked.filter((t) => t.id !== last.track.id);
        discoveries = discoveries.filter((t) => t.id !== last.track.id);
        playlists = playlists.map((p) => ({
          ...p,
          tracks: p.tracks.filter((t) => t.id !== last.track.id),
        }));
      }
      if (last.action === "never") {
        neverArtists = neverArtists.filter((a) => a !== last.track.artist);
      }
      return {
        ...state,
        queue: uniqueById([last.track, ...state.queue]),
        history: state.history.slice(0, -1),
        liked,
        discoveries,
        playlists,
        neverArtists,
      };
    }

    case "CREATE_PLAYLIST":
      return { ...state, playlists: [...state.playlists, action.playlist] };

    case "DELETE_PLAYLIST": {
      const saveTarget =
        state.saveTarget === `pl:${action.id}` ? "liked" : state.saveTarget;
      return {
        ...state,
        playlists: state.playlists.filter((p) => p.id !== action.id),
        saveTarget,
      };
    }

    case "REMOVE_SONG":
      return {
        ...state,
        liked: state.liked.filter((t) => t.id !== action.trackId),
        discoveries: state.discoveries.filter((t) => t.id !== action.trackId),
        playlists: state.playlists.map((p) => ({
          ...p,
          tracks: p.tracks.filter((t) => t.id !== action.trackId),
        })),
      };

    case "SET_REPLAY": {
      const allow = new Set(state.replayContainers);
      if (action.allow) allow.add(action.container);
      else allow.delete(action.container);
      return { ...state, replayContainers: [...allow] };
    }

    case "SET_AUTO_ADVANCE":
      return { ...state, autoAdvance: action.value };

    case "JUMP_TO": {
      const target =
        state.queue.find((t) => t.id === action.trackId) ??
        state.catalog.find((t) => t.id === action.trackId);
      if (!target) return state;
      return {
        ...state,
        queue: uniqueById([target, ...state.queue]),
      };
    }

    case "SET_SAVE_TARGET":
      return { ...state, saveTarget: action.target };
  }
}

interface StoreValue {
  state: AppState;
  swipe: (action: SwipeAction) => void;
  back: () => void;
  jumpTo: (trackId: string) => void;
  setSaveTarget: (target: SaveTarget) => void;
  createPlaylist: (playlist: Playlist) => void;
  deletePlaylist: (id: string) => void;
  removeSong: (trackId: string) => void;
  setAutoAdvance: (value: boolean) => void;
  setReplay: (container: string, allow: boolean) => void;
  hydrateRemote: (payload: {
    liked: Track[];
    discoveries: Track[];
    playlists: Playlist[];
    neverArtists: string[];
    neverTracks: string[];
    replayContainers: string[];
    saveTarget: SaveTarget;
  }) => void;
  resetLocal: () => void;
  applyCatalog: (tracks: Track[]) => void;
  catalog: Track[];
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const loaded = useRef(false);

  useEffect(() => {
    void (async () => {
      let raw = await AsyncStorage.getItem(PERSIST_KEY);
      if (!raw) raw = await AsyncStorage.getItem(LEGACY_KEY); // one-way v1 → v2
      loaded.current = true;
      let payload: Persisted = {};
      try {
        payload = raw ? (JSON.parse(raw) as Persisted) : {};
      } catch {
        payload = {};
      }
      dispatch({ type: "HYDRATE", payload });
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current || !state.hydrated) return;
    const {
      liked,
      discoveries,
      playlists,
      neverArtists,
      saveTarget,
      boostGenres,
      autoAdvance,
    } = state;
    void AsyncStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        liked,
        discoveries,
        playlists,
        neverArtists,
        saveTarget,
        boostGenres,
        autoAdvance,
      }),
    );
  }, [
    state.liked,
    state.discoveries,
    state.playlists,
    state.neverArtists,
    state.saveTarget,
    state.boostGenres,
    state.autoAdvance,
    state.hydrated,
  ]);

  // CRITICAL: actions are memoized once (dispatch is stable). They must NOT
  // be recreated per state change — effects depend on these functions, and
  // changing identities re-fire the effects, which dispatch again → an
  // infinite "Maximum update depth exceeded" render loop.
  const actions = useMemo(
    () => ({
      swipe: (action: SwipeAction) => dispatch({ type: "SWIPE", action }),
      back: () => dispatch({ type: "BACK" }),
      jumpTo: (trackId: string) => dispatch({ type: "JUMP_TO", trackId }),
      applyCatalog: (tracks: Track[]) => dispatch({ type: "APPLY_CATALOG", tracks }),
      setReplay: (container: string, allow: boolean) =>
        dispatch({ type: "SET_REPLAY", container, allow }),
      setSaveTarget: (target: SaveTarget) => dispatch({ type: "SET_SAVE_TARGET", target }),
      createPlaylist: (playlist: Playlist) => dispatch({ type: "CREATE_PLAYLIST", playlist }),
      deletePlaylist: (id: string) => dispatch({ type: "DELETE_PLAYLIST", id }),
      removeSong: (trackId: string) => dispatch({ type: "REMOVE_SONG", trackId }),
      setAutoAdvance: (value: boolean) => dispatch({ type: "SET_AUTO_ADVANCE", value }),
      hydrateRemote: (payload: {
        liked: Track[];
        discoveries: Track[];
        playlists: Playlist[];
        neverArtists: string[];
        neverTracks: string[];
        replayContainers: string[];
        saveTarget: SaveTarget;
      }) => dispatch({ type: "HYDRATE_REMOTE", ...payload }),
      resetLocal: () => {
        void AsyncStorage.removeItem(PERSIST_KEY);
        dispatch({ type: "RESET" });
      },
    }),
    [],
  );

  const value = useMemo<StoreValue>(
    () => ({ state, ...actions, catalog: state.catalog }),
    [state, actions],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
