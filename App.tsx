import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { Feather } from "@expo/vector-icons";
import {
  Unbounded_700Bold,
  Unbounded_900Black,
} from "@expo-google-fonts/unbounded";
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from "@expo-google-fonts/instrument-sans";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { ConvexReactClient, useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { coerceTaste } from "./src/data/taste";
import { coercePrefs, type UserPrefs } from "./src/data/prefs";
import { authClient } from "./src/lib/auth-client";
import { StoreProvider, useStore } from "./src/state/store";
import { enqueue, flush } from "./src/lib/outbox";
import { SwipeDeck } from "./src/components/SwipeDeck";
import { hooksOf, sourceOf, windowTiming } from "./src/lib/hooks";
import { HomeScreen } from "./src/components/HomeScreen";
import { LibraryScreen } from "./src/components/LibraryScreen";
import { SettingsScreen } from "./src/components/SettingsScreen";
import { AppearancePage } from "./src/components/settings/AppearancePage";
import { PlaybackPage } from "./src/components/settings/PlaybackPage";
import { GesturesPage } from "./src/components/settings/GesturesPage";
import { SoundPage } from "./src/components/settings/SoundPage";
import { DataPage } from "./src/components/settings/DataPage";
import { AppErrorBoundary } from "./src/components/AppErrorBoundary";
import { ProfileScreen } from "./src/components/ProfileScreen";
import { Onboarding } from "./src/components/Onboarding";
import { BottomNav } from "./src/components/BottomNav";
import { SaveTargetSheet } from "./src/components/SaveTargetSheet";
import { NewPlaylistSheet } from "./src/components/NewPlaylistSheet";
import { FullSongSheet } from "./src/components/FullSongSheet";
import { UpdateBanner } from "./src/components/UpdateBanner";
import { SponsoredCard, type AdCardData } from "./src/components/SponsoredCard";
import { shouldAskForAd } from "./src/lib/ads-scheduler";
import { colors, fonts, radii } from "./src/design/tokens";
import {
  DIR_TO_ACTION,
  type LibraryContainer,
  type SaveTarget,
  type SwipeDir,
  type Track,
} from "./src/types";
import { art } from "./src/lib/art";
import { BUILD_TAG } from "./src/buildInfo";
import { CONVEX_URL, SITE_URL } from "./src/config/env";

const ONBOARD_KEY = "hooked.onboarded.v1";
const ANON_SWIPES_KEY = "hooked.anonSwipes.v1";
const VOLUME_KEY = "hooked.volume";
const FREE_SWIPES = 5;

const convex = new ConvexReactClient(CONVEX_URL);

type SettingsPageId = "appearance" | "playback" | "gestures" | "sound" | "data";
type Screen =
  | "home"
  | "discover"
  | "profile"
  | "settings"
  | `library:${string}`
  | `settings:${SettingsPageId}`;

// ----- server <-> local track mapping (mirrors web/src/App.tsx) -----

interface ServerTrack {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  previewUrl: string;
  durationMs: number;
  genre: string;
  accent: string;
}

interface ServerLibrary {
  liked: ServerTrack[];
  discoveries: ServerTrack[];
  playlists: {
    id: string;
    name: string;
    accent: string;
    songs: ServerTrack[];
  }[];
  neverArtists: string[];
  neverTracks?: string[];
  taste?: { languages: string[]; genres: string[]; adventure: string } | null;
  prefs?: Partial<UserPrefs> | null;
  replayContainers?: string[];
  saveTarget: string;
  isAdmin: boolean;
  permissions: string[];
  email: string;
}

const toServer = (t: Track): ServerTrack => ({
  trackId: t.id,
  title: t.title,
  artist: t.artist,
  album: t.album,
  artwork: t.artwork,
  previewUrl: t.previewUrl,
  durationMs: t.durationMs,
  genre: t.genre,
  accent: t.accent,
});

/** The catalogue sends hooks and, for uploads, full audio. */
interface ServerCatalogTrack extends ServerTrack {
  audioUrl?: string | null;
  hooks?: { id: string; startMs: number; durationMs: number; label?: string }[];
  markets?: string[];
  heat?: number;
}

const toLocalCatalog = (t: ServerCatalogTrack): Track => ({
  ...toLocal(t),
  audioUrl: t.audioUrl ?? undefined,
  hooks: t.hooks,
  markets: t.markets,
  heat: t.heat,
});

const toLocal = (t: ServerTrack): Track => ({
  id: t.trackId,
  title: t.title,
  artist: t.artist,
  album: t.album,
  artwork: t.artwork,
  previewUrl: t.previewUrl,
  durationMs: t.durationMs,
  genre: t.genre,
  accent: t.accent,
});

function Shell() {
  const {
    state,
    swipe,
    back,
    jumpTo,
    setSaveTarget,
    createPlaylist,
    deletePlaylist,
    removeSong,
    hydrateRemote,
    resetLocal,
    applyCatalog,
    setReplay,
    unbury,
    unblockArtist,
    setTaste,
    setPrefs,
  } = useStore();

  // ----- navigation: a real stack -----
  //
  // Screens used to be one useState — no history, so Android's hardware back
  // exited the app from anywhere and "deeper navigation" was impossible.
  // Now every screen is a stack entry: pages push, back pops, tabs reset.
  const [stack, setStack] = useState<Screen[]>(["home"]);
  const screen = stack[stack.length - 1];
  const push = useCallback((s: Screen) => {
    setStack((st) => (st[st.length - 1] === s ? st : [...st, s]));
  }, []);
  const pop = useCallback(() => {
    setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
  }, []);
  const switchTab = useCallback((tab: "home" | "discover") => {
    setStack([tab]);
  }, []);

  // sheets are overlays above whatever screen is showing
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [fullSongOpen, setFullSongOpen] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const anonSwipeCount = useRef(0);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      // duck under phone calls instead of fighting them, keep playing when
      // backgrounded — a music app that stops when you switch apps is broken
      interruptionMode: "duckOthers",
      shouldPlayInBackground: true,
    });
    void AsyncStorage.getItem(ONBOARD_KEY).then((v) => setOnboarded(v === "1"));
    void AsyncStorage.getItem(ANON_SWIPES_KEY).then((v) => {
      anonSwipeCount.current = Number(v) || 0;
    });
  }, []);

  // ----- cloud sync (ported from web/src/App.tsx) -----
  const session = authClient.useSession();
  const signedIn = !!session.data;
  const library = useQuery(anyApi.library.getLibrary) as
    | ServerLibrary
    | null
    | undefined;
  // The catalogue itself, not just the ids. Reading ids alone was why the app
  // kept dealing its own bundled copies — hooks, creator uploads and imported
  // songs all live server-side and never reached a card.
  const serverTracks = useQuery(anyApi.tracks.list) as
    | ServerCatalogTrack[]
    | null
    | undefined;
  const ensureProfile = useMutation(anyApi.library.ensureProfile);
  const recordSwipeMutation = useMutation(anyApi.library.recordSwipe);
  const revertSwipeMutation = useMutation(anyApi.library.revertSwipe);
  const saveTargetMutation = useMutation(anyApi.library.setSaveTarget);
  const createPlaylistMutation = useMutation(anyApi.library.createPlaylist);
  const deletePlaylistMutation = useMutation(anyApi.library.deletePlaylist);
  const removeSongMutation = useMutation(anyApi.library.removeSong);
  const deleteAccountMutation = useMutation(anyApi.library.deleteMyAccount);
  const setReplayMutation = useMutation(anyApi.library.setReplayContainer);
  const unburyMutation = useMutation(anyApi.library.unburyTrack);
  const unblockArtistMutation = useMutation(anyApi.library.unblockArtist);
  const setTasteMutation = useMutation(anyApi.library.setTaste);
  const setPrefsMutation = useMutation(anyApi.library.setPrefs);
  const recordAdEvent = useMutation(anyApi.ads.recordEvent);

  // live runtime config — the free-swipe wall is admin-tunable, pushed live
  const runtimeCfg = useQuery(anyApi.runtime.get) as
    | { gateFreeSwipes: number }
    | null
    | undefined;

  useEffect(() => {
    // An empty catalogue is a REAL state (admin hid everything) — honour it
    // rather than dealing tracks the server buried.
    if (serverTracks !== undefined && serverTracks !== null) {
      applyCatalog(serverTracks.map(toLocalCatalog));
    }
  }, [serverTracks, applyCatalog]);

  /**
   * The write-ahead log. Failed mutations used to vanish; now they queue and
   * drain here — on sign-in and every time the app comes to the foreground.
   */
  const flushOutbox = useCallback(async () => {
    if (!signedIn) return;
    await flush(async (item) => {
      const fn = {
        recordSwipe: recordSwipeMutation,
        revertSwipe: revertSwipeMutation,
        setSaveTarget: saveTargetMutation,
        removeSong: removeSongMutation,
        unburyTrack: unburyMutation,
        unblockArtist: unblockArtistMutation,
        setReplayContainer: setReplayMutation,
        setTaste: setTasteMutation,
        setPrefs: setPrefsMutation,
        deletePlaylist: deletePlaylistMutation,
      }[item.fn];
      await fn(item.args as never);
    });
  }, [
    signedIn,
    recordSwipeMutation,
    revertSwipeMutation,
    saveTargetMutation,
    removeSongMutation,
    unburyMutation,
    unblockArtistMutation,
    setReplayMutation,
    setTasteMutation,
    setPrefsMutation,
    deletePlaylistMutation,
  ]);

  useEffect(() => {
    if (signedIn) void flushOutbox();
  }, [signedIn, flushOutbox]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void flushOutbox();
    });
    return () => sub.remove();
  }, [flushOutbox]);

  /** Queue-or-send helper: fire-and-forget that never actually forgets. */
  const syncWrite = useCallback(
    (
      fn: Parameters<typeof enqueue>[0]["fn"],
      args: Record<string, unknown>,
      mutate: (a: never) => Promise<unknown>,
    ) => {
      mutate(args as never).catch(() => {
        void enqueue({ fn, args } as Parameters<typeof enqueue>[0]);
      });
    },
    [],
  );

  /**
   * The app is invite-only. ensureProfile refuses to create a profile until an
   * admin approves the email, and the reason comes back in the error — which
   * this used to swallow, so an unapproved account looked signed in and simply
   * never synced.
   */
  const [accessState, setAccessState] = useState<
    "ok" | "pending" | "rejected" | "none" | null
  >(null);
  useEffect(() => {
    if (!signedIn) {
      setAccessState(null);
      return;
    }
    void ensureProfile({})
      .then(() => setAccessState("ok"))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("ACCESS_PENDING")) setAccessState("pending");
        else if (message.includes("ACCESS_REJECTED")) setAccessState("rejected");
        else if (message.includes("ACCESS_NOT_REQUESTED")) setAccessState("none");
        else setAccessState(null); // a network blip is not a rejection
      });
  }, [signedIn, ensureProfile]);

  useEffect(() => {
    if (signedIn) {
      anonSwipeCount.current = 0;
      void AsyncStorage.removeItem(ANON_SWIPES_KEY);
    }
  }, [signedIn]);

  /**
   * Google Play requires an in-app way to delete an account for any app that
   * lets you create one. This erases the server side, clears what's on the
   * device — including the anonymous-swipe counter, or a deleted user would
   * reinstall straight into their own old paywall — and signs out.
   */
  const handleDeleteAccount = useCallback(() => {
    void (async () => {
      try {
        await deleteAccountMutation({});
      } catch (err) {
        Alert.alert(
          "Could not delete the account",
          err instanceof Error ? err.message : "Try again in a moment.",
        );
        return;
      }
      resetLocal();
      await AsyncStorage.removeItem(ANON_SWIPES_KEY).catch(() => undefined);
      anonSwipeCount.current = 0;
      await authClient.signOut().catch(() => undefined);
      setStack(["home"]);
      Alert.alert("Account deleted", "Everything tied to your account is gone.");
    })();
  }, [deleteAccountMutation, resetLocal]);

  /** Local first so the toggle is instant; the server is the record of truth. */
  const handleReplay = useCallback(
    (container: string, allow: boolean) => {
      setReplay(container, allow);
      if (signedIn) {
        syncWrite("setReplayContainer", { container, allow }, setReplayMutation);
      }
    },
    [setReplay, signedIn, setReplayMutation, syncWrite],
  );

  const handleUnbury = useCallback(
    (trackId: string) => {
      unbury(trackId);
      if (signedIn) syncWrite("unburyTrack", { trackId }, unburyMutation);
    },
    [unbury, signedIn, unburyMutation, syncWrite],
  );

  const handleUnblockArtist = useCallback(
    (artist: string) => {
      unblockArtist(artist);
      if (signedIn) syncWrite("unblockArtist", { artist }, unblockArtistMutation);
    },
    [unblockArtist, signedIn, unblockArtistMutation, syncWrite],
  );

  const promptAuth = useCallback(
    (message: string) => {
      Alert.alert("Create an account", message, [
        { text: "Not now", style: "cancel" },
        { text: "Sign in", onPress: () => push("profile") },
      ]);
    },
    [push],
  );

  /** The login wall refuses BEFORE anything commits — web parity. */
  const gateSwipe = useCallback(
    (dir: SwipeDir): boolean => {
      if (signedIn) return true;
      const action = DIR_TO_ACTION[dir];
      if (action === "save") {
        promptAuth("Create an account to save songs and playlists across devices.");
        return false;
      }
      // the wall's distance is live config (gateFreeSwipes) — admins move it
      // without a release; 5 covers the moment before the query first answers
      if (anonSwipeCount.current >= (runtimeCfg?.gateFreeSwipes ?? FREE_SWIPES)) {
        promptAuth(
          "You've used your 5 free swipes. Sign in to keep discovering and sync your taste.",
        );
        return false;
      }
      anonSwipeCount.current += 1;
      void AsyncStorage.setItem(ANON_SWIPES_KEY, String(anonSwipeCount.current));
      return true;
    },
    [signedIn, promptAuth, runtimeCfg],
  );

  // hydrate the local store from the cloud library ONCE per signed-in user —
  // keyed by user id, NOT by query nullability: a transient null frame from
  // the reactive query must not re-trigger hydration (a mid-session
  // re-hydrate rebuilds the queue under the user's fingers)
  const hydratedFor = useRef<string | null>(null);
  const sessionUid = session.data?.user?.id ?? null;
  useEffect(() => {
    if (!sessionUid) {
      hydratedFor.current = null; // truly signed out
      return;
    }
    if (library && hydratedFor.current !== sessionUid) {
      hydratedFor.current = sessionUid;
      hydrateRemote({
        liked: library.liked.map(toLocal),
        discoveries: library.discoveries.map(toLocal),
        playlists: library.playlists.map((p) => ({
          id: String(p.id),
          name: p.name,
          accent: p.accent,
          tracks: p.songs.map(toLocal),
        })),
        neverArtists: library.neverArtists,
        neverTracks: library.neverTracks ?? [],
        replayContainers: library.replayContainers ?? [],
        taste: coerceTaste(library.taste),
        prefs: coercePrefs(library.prefs),
        saveTarget: library.saveTarget as SaveTarget,
      });
    }
  }, [library, sessionUid, hydrateRemote]);

  /** Push pref changes to the profile, debounced so slider drags don't spam. */
  const prefsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSetPrefs = useCallback(
    (p: Partial<UserPrefs>) => {
      setPrefs(p); // local-first: instant, works offline
      if (!signedIn) return;
      clearTimeout(prefsTimer.current);
      prefsTimer.current = setTimeout(() => {
        const merged = { ...state.prefs, ...p };
        syncWrite(
          "setPrefs",
          {
            motion: merged.motion,
            haptics: merged.haptics,
            accentMode: merged.accentMode,
            accentColor: merged.accentColor,
            swipeSensitivity: merged.swipeSensitivity,
            adsOptOut: merged.adsOptOut,
          },
          setPrefsMutation,
        );
      }, 600);
    },
    [setPrefs, signedIn, state.prefs, setPrefsMutation, syncWrite],
  );

  // ----- house ads: server owns caps+cooldown, the deck owns pacing -----
  const anonKeyRef = useRef<string | null>(null);
  useEffect(() => {
    void AsyncStorage.getItem("hooked.anon").then((k) => {
      if (k) {
        anonKeyRef.current = k;
        return;
      }
      const fresh = `anon-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      void AsyncStorage.setItem("hooked.anon", fresh);
      anonKeyRef.current = fresh;
    });
  }, []);

  const adsConfig = useQuery(
    anyApi.ads.getConfig,
    state.prefs.adsOptOut ? "skip" : {},
  ) as
    | { enabled: boolean; everyNSwipes: number; cooldownMinutes: number; maxPerDay: number }
    | null
    | undefined;

  const swipeCounterAd = useRef(0);
  const lastAdAt = useRef(0);
  const [adDue, setAdDue] = useState(false);
  const [activeAd, setActiveAd] = useState<AdCardData | null>(null);

  const noteSwipeForAds = useCallback(() => {
    // handleSwipe is only reachable from the deck, so being here means Discover
    swipeCounterAd.current += 1;
    // the listener's dial can only space cards further apart
    const scale =
      state.prefs.adFrequency === "often"
        ? 0.5
        : state.prefs.adFrequency === "rarely"
          ? 2
          : 1;
    const effective =
      adsConfig == null
        ? null
        : {
            ...adsConfig,
            everyNSwipes: Math.max(3, Math.round(adsConfig.everyNSwipes * scale)),
          };
    const due = shouldAskForAd({
      swipesSinceAd: swipeCounterAd.current,
      now: Date.now(),
      lastAdAt: lastAdAt.current,
      optedOut: state.prefs.adsOptOut,
      config: effective,
    });
    if (due) setAdDue(true); // nextAd decides authoritatively
  }, [state.prefs.adsOptOut, state.prefs.adFrequency, adsConfig]);

  const adCandidate = useQuery(
    anyApi.ads.nextAd,
    adDue
      ? {
          anonKey: anonKeyRef.current ?? undefined,
        }
      : "skip",
  );

  useEffect(() => {
    if (!adDue || adCandidate === undefined) return;
    setAdDue(false);
    if (adCandidate) {
      lastAdAt.current = Date.now();
      swipeCounterAd.current = 0;
      setActiveAd(adCandidate as unknown as AdCardData);
      void recordAdEvent({
        adId: adCandidate.id as never,
        kind: "impression",
        anonKey: anonKeyRef.current ?? undefined,
      }).catch(() => undefined);
    }
  }, [adDue, adCandidate, recordAdEvent, signedIn, sessionUid]);

  const closeActiveAd = useCallback(
    (kind: "click" | "skip") => {
      if (activeAd) {
        void recordAdEvent({
          adId: activeAd.id as never,
          kind,
          anonKey: anonKeyRef.current ?? undefined,
        }).catch(() => undefined);
      }
      setActiveAd(null);
    },
    [activeAd, recordAdEvent, signedIn, sessionUid],
  );

  const onDeck = state.queue[0] ?? null;
  const previousEntry = state.history.length
    ? state.history[state.history.length - 1]
    : null;
  const previous = previousEntry?.track ?? null;
  // the gate screens render as an early return, but this component and all
  // its effects stay mounted — so "on the discover screen" has to mean
  // "allowed to be here", or previews kept advancing song after song behind
  // the waiting room with nothing visible to stop them
  const isGated = accessState !== null && accessState !== "ok";
  const inDiscover = screen === "discover" && onboarded === true && !isGated;

  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  // belt and braces: if the gate appears mid-track, silence it NOW instead of
  // waiting for the next effect cycle to notice inDiscover flipped
  useEffect(() => {
    if (isGated) player.pause();
  }, [isGated, player]);

  // device-local volume: hardware differs, so this never syncs to the profile
  const [volume, setVolumeState] = useState(1);
  useEffect(() => {
    void AsyncStorage.getItem(VOLUME_KEY).then((v) => {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 1) {
        setVolumeState(n);
        player.volume = n;
      }
    });
  }, [player]);
  const handleVolume = useCallback(
    (v: number) => {
      const clamped = Math.min(Math.max(v, 0), 1);
      setVolumeState(clamped);
      player.volume = clamped;
      void AsyncStorage.setItem(VOLUME_KEY, String(clamped));
    },
    [player],
  );

  // armed whenever something moves playback on purpose, so the auto-advance
  // checks below don't also fire and skip two cards at once
  const lastSwipeAt = useRef(0);

  const hooks = hooksOf(onDeck);
  const [hookIndex, setHookIndex] = useState(0);
  const hookIndexRef = useRef(0);
  hookIndexRef.current = hookIndex;
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
  // a seek issued before the source is loaded is dropped, so it waits here
  const pendingSeekRef = useRef<number | null>(null);

  useEffect(() => {
    if (inDiscover && onDeck) {
      setHookIndex(0);
      hookIndexRef.current = 0;
      player.replace({ uri: sourceOf(onDeck) });
      const first = hooksRef.current[0];
      pendingSeekRef.current = first.startMs > 0 ? first.startMs / 1000 : null;
      player.play();
    } else {
      player.pause();
    }
  }, [inDiscover, onDeck?.id]);

  // the deferred seek, once there is something to seek in
  useEffect(() => {
    const target = pendingSeekRef.current;
    if (target === null || !status.isLoaded) return;
    pendingSeekRef.current = null;
    void player.seekTo(target);
  }, [status.isLoaded, player]);

  /**
   * Move to the next window. `auto` means the window simply ran out, so once
   * the last one is done the card is finished — a tap on the last one wraps
   * instead, rather than skipping the song out from under someone.
   */
  const advanceHook = useCallback(
    (auto: boolean) => {
      const list = hooksRef.current;
      const next = hookIndexRef.current + 1;
      if (next >= list.length) {
        if (auto) return false; // caller decides what "song over" means
        hookIndexRef.current = 0;
        setHookIndex(0);
      } else {
        hookIndexRef.current = next;
        setHookIndex(next);
      }
      const target = list[hookIndexRef.current];
      lastSwipeAt.current = Date.now();
      void player.seekTo(target.startMs / 1000);
      if (!status.playing) player.play();
      return true;
    },
    [player, status.playing],
  );

  const handleNextHook = useCallback(() => {
    advanceHook(false);
  }, [advanceHook]);

  /**
   * Dead audio must not park the deck. Keyed on the track id too: two dead
   * tracks in a row can produce identical error strings, and an effect keyed
   * on the error alone never re-fired for the second one.
   */
  const onDeckId = onDeck?.id;
  useEffect(() => {
    if (!inDiscover || !status.error || !onDeckId) return;
    if (Date.now() - lastSwipeAt.current < 700) return;
    console.warn(`[audio] ${onDeckId}: ${String(status.error)} — skipping`);
    lastSwipeAt.current = Date.now();
    swipe("skip");
  }, [status.error, inDiscover, onDeckId]);

  // A window running out moves to the next hook; the *last* window running out
  // is what "the song ended" now means. Skip still skips the song, so all four
  // gestures stay free — this is why hooks advance on time and tap only.
  useEffect(() => {
    if (!inDiscover || !status.isLoaded || status.duration <= 0) return;
    if (Date.now() - lastSwipeAt.current < 700) return;
    const hook = hooksRef.current[hookIndexRef.current] ?? hooksRef.current[0];
    const { done } = windowTiming(hook, status.currentTime, status.duration);
    if (!done) return;
    if (!advanceHook(true) && state.autoAdvance) swipe("skip");
  }, [status.currentTime, inDiscover, status.isLoaded, status.duration]);

  useEffect(() => {
    // preview ended → auto-advance, unless the user turned that off.
    // Gated on Discover being visible, and skipped right after any manual
    // interaction — double advances make the cards/photos jump around.
    if (
      inDiscover &&
      status.didJustFinish &&
      state.autoAdvance &&
      Date.now() - lastSwipeAt.current > 700
    ) {
      swipe("skip");
    }
  }, [status.didJustFinish]);

  // arms the interaction guard the moment a gesture COMMITS (the queue
  // advance lands ~260ms later when the fly-out finishes — auto-advance and
  // ↩ must not act inside that window or they hit the wrong track)
  const handleSwipeStart = useCallback(() => {
    lastSwipeAt.current = Date.now();
  }, []);

  const handleSwipe = useCallback(
    (dir: SwipeDir) => {
      lastSwipeAt.current = Date.now();
      noteSwipeForAds();
      const track = onDeck;
      const action = DIR_TO_ACTION[dir];
      swipe(action);
      if (signedIn && track) {
        // credit the playing hook so save-rate ranking learns from mobile
        // too — web does the same. Synthetic baked ids ("123:0") and the
        // "whole" fallback fail Convex validation, hence the shape guard.
        const playing = hooksRef.current[hookIndexRef.current] ?? hooksRef.current[0];
        const hookId =
          playing && /^[a-z0-9]{20,}$/.test(playing.id) ? playing.id : undefined;
        syncWrite(
          "recordSwipe",
          { track: toServer(track), action, ...(hookId ? { hookId } : {}) },
          recordSwipeMutation,
        );
      }
    },
    [swipe, onDeck, signedIn, recordSwipeMutation, syncWrite, noteSwipeForAds],
  );

  // bumping this cancels any in-flight save animation in the deck — going
  // back while the disc is still sliding in would otherwise show the same
  // song twice (top card + the disc below it)
  const [backToken, setBackToken] = useState(0);

  const handleBack = useCallback(() => {
    if (!previousEntry) return;
    // ignore ↩ while a fly-out is mid-air: the swipe it belongs to hasn't
    // committed yet, so reverting now would target the WRONG entry
    if (Date.now() - lastSwipeAt.current < 350) return;
    lastSwipeAt.current = Date.now(); // and shield the restored card from auto-advance
    back();
    setBackToken((t) => t + 1);
    // a re-like of an already-saved song added nothing, so there's nothing
    // to revert server-side (reverting would wrongly delete the library row)
    const noopSave =
      previousEntry.action === "save" && !previousEntry.savedToLibrary;
    if (signedIn && !noopSave) {
      syncWrite(
        "revertSwipe",
        {
          trackId: previousEntry.track.id,
          artist: previousEntry.track.artist,
          action: previousEntry.action,
        },
        revertSwipeMutation,
      );
    }
  }, [back, previousEntry, signedIn, revertSwipeMutation, syncWrite]);

  const handleSaveTarget = useCallback(
    (target: SaveTarget) => {
      setSaveTarget(target);
      if (signedIn) syncWrite("setSaveTarget", { target }, saveTargetMutation);
    },
    [setSaveTarget, signedIn, saveTargetMutation, syncWrite],
  );

  const handleToggle = useCallback(
    () => (status.playing ? player.pause() : player.play()),
    [status.playing, player],
  );

  const handleSeek = useCallback(
    (fraction: number) => {
      if (status.duration <= 0) return;
      // arm the guard: scrubbing to the very end fires didJustFinish, and an
      // immediate auto-advance would chain-skip cards under the scrub
      lastSwipeAt.current = Date.now();
      // the bar spans the current window, not the whole file
      const hook = hooksRef.current[hookIndexRef.current] ?? hooksRef.current[0];
      const { startS, lengthS } = windowTiming(hook, status.currentTime, status.duration);
      const clamped = Math.min(Math.max(fraction, 0), 0.999);
      void player.seekTo(startS + clamped * lengthS);
    },
    [player, status.duration, status.currentTime],
  );

  const goDiscover = useCallback(
    (trackId?: string) => {
      if (trackId) jumpTo(trackId);
      switchTab("discover");
    },
    [jumpTo, switchTab],
  );

  const handleCreatePlaylist = useCallback(
    async (
      name: string,
      accent: string,
      rules?: {
        allowRepeats?: boolean;
        includeBuried?: boolean;
        includeBlockedArtists?: boolean;
      },
    ): Promise<string> => {
      let id = `local-${Date.now()}`;
      if (signedIn) {
        try {
          id = String(await createPlaylistMutation({ name, accent, ...rules }));
        } catch {
          /* keep local id */
        }
      }
      createPlaylist({ id, name, accent, tracks: [], ...rules });
      return id;
    },
    [signedIn, createPlaylistMutation, createPlaylist],
  );

  /** FAB flow: create the playlist AND make it the swipe-down destination. */
  const handleCreateAndTarget = useCallback(
    async (name: string, accent: string) => {
      const id = await handleCreatePlaylist(name, accent);
      handleSaveTarget(`pl:${id}`);
    },
    [handleCreatePlaylist, handleSaveTarget],
  );

  /** "Discover into this": point saves at the container, then go swipe. */
  const handleDiscoverInto = useCallback(
    (container: LibraryContainer) => {
      handleSaveTarget(container as SaveTarget);
      switchTab("discover");
    },
    [handleSaveTarget, switchTab],
  );

  const handleDeletePlaylist = useCallback(
    (id: string) => {
      deletePlaylist(id);
      if (signedIn && !id.startsWith("local-")) {
        // a silently-lost delete would resurrect the playlist at the next
        // hydration, so this one queues like the rest
        void deletePlaylistMutation({ playlistId: id }).catch(() =>
          enqueue({ fn: "deletePlaylist", args: { playlistId: id } }),
        );
      }
    },
    [deletePlaylist, signedIn, deletePlaylistMutation],
  );

  const handleRemoveSong = useCallback(
    (trackId: string) => {
      removeSong(trackId);
      if (signedIn) syncWrite("removeSong", { trackId }, removeSongMutation);
    },
    [removeSong, signedIn, removeSongMutation, syncWrite],
  );

  const handleReplayTutorial = useCallback(() => {
    void AsyncStorage.removeItem(ONBOARD_KEY);
    setOnboarded(false);
  }, []);

  const handleResetData = useCallback(() => {
    resetLocal();
    setStack(["home"]);
  }, [resetLocal]);

  // ----- derived look & feel from prefs -----
  const accent =
    state.prefs.accentMode === "custom"
      ? state.prefs.accentColor
      : inDiscover && onDeck
        ? onDeck.accent
        : colors.accentDefault;

  const currentHook = hooks[hookIndex] ?? hooks[0];
  const timing =
    status.duration > 0
      ? windowTiming(currentHook, status.currentTime, status.duration)
      : null;
  const progress = timing?.progress ?? 0;
  const remaining = timing?.remaining ?? Number.POSITIVE_INFINITY;

  // tutorial deals from cards 4–8; a thin queue tops up from the catalogue so
  // `index % length` can't hit an empty array
  const demoTracks = useMemo(() => {
    const fromQueue = state.queue.slice(3, 8);
    if (fromQueue.length >= 5) return fromQueue;
    const used = new Set([...state.queue.slice(0, 3), ...fromQueue].map((t) => t.id));
    const extra = state.catalog.filter((t) => !used.has(t.id)).slice(0, 5 - fromQueue.length);
    return [...fromQueue, ...extra];
  }, [state.queue, state.catalog]);

  // ----- deep links: hooked://track/<id> opens that track on the deck -----
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const m = /^hooked:\/\/track\/(.+)$/i.exec(url);
      if (m?.[1]) {
        jumpTo(decodeURIComponent(m[1]));
        setStack(["discover"]);
      }
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => sub.remove();
  }, [jumpTo]);

  // ----- Android hardware back -----
  const anySheetOpen = saveSheetOpen || newPlaylistOpen || fullSongOpen;
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (anySheetOpen) {
        // let the sheet's own backdrop/back handling close it
        return false;
      }
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false; // root screens: default behaviour (exit)
    });
    return () => sub.remove();
  }, [anySheetOpen, stack.length, pop]);

  if (onboarded === null || !state.hydrated) {
    return <View style={styles.root} />;
  }

  // Signed in, but the account isn't approved. This used to be swallowed, so
  // the app looked signed in and quietly never synced anything.
  if (accessState && accessState !== "ok") {
    const copy = {
      pending: {
        title: "thank you for your interest",
        body: "Your request is with us. We'll get back to you — once you're approved this screen becomes the deck.",
      },
      rejected: {
        title: "not this round",
        body: "Your request wasn't approved for this round. Nothing else on your account has changed.",
      },
      none: {
        title: "hooked is invite-only",
        body: "Ask for access and we'll get back to you. It takes a minute.",
      },
    }[accessState];
    return (
      <View style={[styles.root, styles.gate]}>
        <Text style={styles.gateTitle}>{copy.title}</Text>
        <Text style={styles.gateBody}>{copy.body}</Text>
        {accessState === "none" && (
          <Pressable
            style={styles.gateButton}
            onPress={() => {
              void Linking.openURL(`${SITE_URL}/beta`).catch(() => undefined);
            }}
          >
            <Text style={styles.gateButtonText}>ask for access</Text>
          </Pressable>
        )}
        <Pressable onPress={() => void authClient.signOut()}>
          <Text style={styles.gateLink}>sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (!onboarded) {
    return (
      <Onboarding
        demoTracks={demoTracks}
        demoCatalog={state.catalog}
        onFinish={(taste) => {
          void AsyncStorage.setItem(ONBOARD_KEY, "1");
          // apply locally first so the very first deck is already tilted; the
          // server copy is for the next device they sign in on
          setTaste(taste);
          if (signedIn) syncWrite("setTaste", { ...taste }, setTasteMutation);
          setOnboarded(true);
          setStack(["discover"]);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {screen === "home" && (
        <>
          <View style={styles.topbar}>
            <Pressable
              style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
              onPress={() => push("profile")}
            >
              <Feather
                name="user"
                size={18}
                color={signedIn ? accent : colors.text}
              />
            </Pressable>
            <Text style={styles.wordmark}>
              hooked<Text style={{ color: accent }}>.</Text>
            </Text>
            <Pressable
              style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
              onPress={() => push("settings")}
            >
              <Feather name="settings" size={18} color={colors.text} />
            </Pressable>
          </View>
          <HomeScreen
            accent={accent}
            onDiscover={goDiscover}
            onOpenLibrary={(c) => push(`library:${c}`)}
            onNewPlaylist={() => setNewPlaylistOpen(true)}
          />
        </>
      )}

      {screen === "discover" && (
        <>
          <View style={styles.topbar}>
            <Pressable
              style={({ pressed }) => [
                styles.topBtn,
                { opacity: previous ? 1 : 0.3 },
                pressed && styles.topBtnPressed,
              ]}
              disabled={!previous}
              onPress={handleBack}
            >
              {previous && (
                <Image
                  source={{ uri: art(previous.artwork, 100) }}
                  style={styles.topBtnArt}
                />
              )}
              <Feather name="corner-up-left" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.wordmark}>
              hooked<Text style={{ color: accent }}>.</Text>
            </Text>
            <Pressable
              style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
              onPress={() => setSaveSheetOpen(true)}
            >
              <Feather
                name={state.saveTarget === "liked" ? "heart" : "folder"}
                size={18}
                color={state.saveTarget === "liked" ? colors.save : colors.more}
              />
            </Pressable>
          </View>
          <SwipeDeck
            tracks={state.queue.slice(0, 3)}
            backToken={backToken}
            progress={progress}
            remaining={remaining}
            playing={status.playing}
            saveTarget={state.saveTarget}
            fullSongOpen={fullSongOpen}
            onToggle={handleToggle}
            onSeek={handleSeek}
            hookIndex={hookIndex}
            hookCount={hooks.length}
            hookLabel={currentHook?.label}
            onNextHook={handleNextHook}
            onOpenFullSong={() => setFullSongOpen(true)}
            onSwipeStart={handleSwipeStart}
            onSwipe={handleSwipe}
            gateSwipe={gateSwipe}
            sensitivity={state.prefs.swipeSensitivity}
            motion={state.prefs.motion}
            haptics={state.prefs.haptics}
          />
          {/* house ad between swipes — music keeps playing under it */}
          {activeAd && (
            <SponsoredCard
              ad={activeAd}
              onSkip={() => closeActiveAd("skip")}
              onOpen={() => {
                closeActiveAd("click");
                void Linking.openURL(activeAd.ctaUrl).catch(() => undefined);
              }}
            />
          )}
          {/* faint build tag: proves which bundle the device is running */}
          <Text style={styles.buildTag}>{BUILD_TAG}</Text>
        </>
      )}

      {screen === "profile" && (
        <ProfileScreen
          accent={accent}
          onBack={pop}
          onPlay={(id) => goDiscover(id)}
        />
      )}

      {screen === "settings" && (
        <SettingsScreen
          onBack={pop}
          signedIn={signedIn}
          onOpen={(page) => push(`settings:${page}`)}
        />
      )}

      {screen === "settings:appearance" && (
        <AppearancePage onBack={pop} />
      )}
      {screen === "settings:playback" && (
        <PlaybackPage
          onBack={pop}
          onOpenSaveTarget={() => setSaveSheetOpen(true)}
          volume={volume}
          onVolume={handleVolume}
        />
      )}
      {screen === "settings:gestures" && <GesturesPage onBack={pop} />}
      {screen === "settings:sound" && (
        <SoundPage
          onBack={pop}
          onReplay={handleReplay}
          onUnbury={handleUnbury}
          onUnblockArtist={handleUnblockArtist}
        />
      )}
      {screen === "settings:data" && (
        <DataPage
          onBack={pop}
          onReplayTutorial={handleReplayTutorial}
          onResetData={handleResetData}
          signedIn={signedIn}
          onDeleteAccount={handleDeleteAccount}
        />
      )}

      {screen.startsWith("library:") && (
        <LibraryScreen
          container={screen.slice(8) as LibraryContainer}
          onBack={pop}
          onPlay={(id) => goDiscover(id)}
          onRemove={handleRemoveSong}
          onDeletePlaylist={handleDeletePlaylist}
          onDiscoverInto={handleDiscoverInto}
        />
      )}

      <BottomNav
        view={screen === "discover" ? "discover" : "home"}
        accent={accent}
        showCreate={screen === "home"}
        onChange={(v) => switchTab(v)}
        onCreate={() => setNewPlaylistOpen(true)}
      />

      {/* over-the-air update: slides in when a bundle has downloaded */}
      <UpdateBanner />

      {saveSheetOpen && (
        <SaveTargetSheet
          value={state.saveTarget}
          playlists={state.playlists}
          accent={accent}
          onChange={handleSaveTarget}
          onCreatePlaylist={(name, swatch) => void handleCreatePlaylist(name, swatch)}
          onClose={() => setSaveSheetOpen(false)}
        />
      )}

      {newPlaylistOpen && (
        <NewPlaylistSheet
          onCreate={(name, swatch) => void handleCreateAndTarget(name, swatch)}
          onClose={() => setNewPlaylistOpen(false)}
        />
      )}

      {fullSongOpen && onDeck && (
        <FullSongSheet track={onDeck} onClose={() => setFullSongOpen(false)} />
      )}

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Unbounded_700Bold,
    Unbounded_900Black,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ConvexBetterAuthProvider client={convex} authClient={authClient}>
          {/* inside the providers, so recovering keeps the session and store */}
          <AppErrorBoundary>
            <StoreProvider>
              <Shell />
            </StoreProvider>
          </AppErrorBoundary>
        </ConvexBetterAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gate: { alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  gateTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  gateBody: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 320,
  },
  gateButton: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.accentDefault,
  },
  gateButtonText: { color: "#0b0b10", fontWeight: "700", fontSize: 14 },
  gateLink: { marginTop: 10, color: colors.muted, fontSize: 13 },
  root: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.3,
  },
  topBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  topBtnPressed: { transform: [{ scale: 0.92 }] },
  buildTag: {
    alignSelf: "center",
    fontFamily: fonts.body,
    fontSize: 9,
    color: "#3A3A46",
    marginTop: 2,
    marginBottom: -2,
  },
  // previous track's artwork fills the round back button under the back icon
  topBtnArt: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.45,
  },
});



