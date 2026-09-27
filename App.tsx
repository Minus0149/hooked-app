import { storedVolume } from "./src/lib/volume";
import { SupportPage } from "./src/components/settings/SupportPage";
import { AccessGate, AccessPending } from "./src/components/AccessGate";
import { DELETE_ACCOUNT_ARGS } from "./src/lib/accountDeletion";
import { PortalHost } from "./src/components/Portal";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  AppState,
  BackHandler,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import { ConvexReactClient, useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { profileCheck } from "./src/lib/authGate";
import { anyApi } from "convex/server";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { coerceTaste } from "./src/data/taste";
import {
  coerceMood,
  DAYPART_MOOD,
  daypartAt,
  moodAtPush,
  moodById,
  moodPlaylistName,
  PLUS_DOWN_GAIN,
  type CrowdMoods,
  type MoodId,
} from "./src/data/mood";
import { MoodWheel } from "./src/components/MoodWheel";
import { DialogProvider, useDialogs } from "./src/components/Dialogs";
import { verdict as verdictFor } from "./src/data/predict";
import { soundScore } from "./src/data/sound";
import { coercePrefs, type UserPrefs } from "./src/data/prefs";
import { authClient } from "./src/lib/auth-client";
import { StoreProvider, useStore } from "./src/state/store";
import { enqueue, flush } from "./src/lib/outbox";
import { SwipeDeck } from "./src/components/SwipeDeck";
import { hooksOf, sourceOf, windowTiming } from "./src/lib/hooks";
import { HomeScreen, type LiveDeck } from "./src/components/HomeScreen";
import { LibraryScreen } from "./src/components/LibraryScreen";
import { SettingsScreen } from "./src/components/SettingsScreen";
import { StatsScreen } from "./src/components/StatsScreen";
import { AppearancePage } from "./src/components/settings/AppearancePage";
import { PlaybackPage } from "./src/components/settings/PlaybackPage";
import { GesturesPage } from "./src/components/settings/GesturesPage";
import { SoundPage } from "./src/components/settings/SoundPage";
import { DataPage } from "./src/components/settings/DataPage";
import { LanguagePage } from "./src/components/settings/LanguagePage";
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
import { PROMOTED_LISTEN_MS, promotedDue, promotedFollowUp, promotedOutcome } from "./src/lib/promoted";
import { colors, fonts, radii, withAlpha } from "./src/design/tokens";
import { LangProvider, useT } from "./src/lib/lang";
import { sessionPosition } from "./src/lib/playSession";
import { useHookOfDay, useNotifySettings } from "./src/lib/useHookOfDay";
import {
  installForegroundHandler,
  onHookNotificationTap,
  scheduleHookNotifications,
} from "./src/lib/hookOfDayNotify";
import { insightContext } from "./src/lib/insightContext";
import { DECK_PLAYS_PER_SESSION, deckTracks } from "./src/lib/features";
import {
  DIR_TO_ACTION,
  type LibraryContainer,
  type SaveTarget,
  type SwipeDir,
  type Track,
} from "./src/types";
import { art } from "./src/lib/art";
import { BlurTargetView } from "expo-blur";
import { BlurTarget } from "./src/components/Backdrop";
import { CONVEX_URL, SITE_URL, WEB_APP_URL } from "./src/config/env";
import { useCatalog } from "./src/lib/useCatalog";
import type { CatalogTrack } from "./src/lib/catalogCodec";

const ONBOARD_KEY = "hooked.onboarded.v1";
const ANON_SWIPES_KEY = "hooked.anonSwipes.v1";
const VOLUME_KEY = "hooked.volume";
const FREE_SWIPES = 5;

const convex = new ConvexReactClient(CONVEX_URL);

type SettingsPageId = "appearance" | "playback" | "gestures" | "sound" | "data" | "support" | "language";
type Screen =
  | "home"
  | "discover"
  | "profile"
  | "settings"
  | "stats"
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
    allowRepeats?: boolean;
    includeBuried?: boolean;
    includeBlockedArtists?: boolean;
    mood?: string | null;
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
  energy?: number;
  sound?: string;
  audioMood?: number[];
  vocal?: number;
  lang?: string;
}

const toLocalCatalog = (t: ServerCatalogTrack): Track => ({
  ...toLocal(t),
  audioUrl: t.audioUrl ?? undefined,
  hooks: t.hooks,
  markets: t.markets,
  heat: t.heat,
  // energy was never mapped here, so the phone's mood lens ran on genre alone
  energy: t.energy,
  sound: t.sound,
  audioMood: t.audioMood,
  vocal: t.vocal,
  lang: t.lang,
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
  const { confirm, notify } = useDialogs();
  const {
    state,
    swipe,
    back,
    jumpTo,
    injectNext,
    setSaveTarget,
    createPlaylist,
    deletePlaylist,
    removeSong,
    hydrateRemote,
    resetLocal,
    applyCatalog,
    applyAffinity,
    setMood,
    applyCrowdMoods,
    applyMoodPicks,
    setStrengths,
    model,
    sound,
    setReplay,
    unbury,
    unblockArtist,
    setTaste,
    setPrefs,
    startSession,
    endSession,
  } = useStore();
  const tx = useT();

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
  // what the overlays' frosted backdrop blurs on Android (see Backdrop)
  const blurTarget = useRef<View>(null);

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
  const { isAuthenticated: backendAuthed } = useConvexAuth();
  const profileStage = profileCheck(signedIn, backendAuthed);
  const library = useQuery(anyApi.library.getLibrary) as
    | ServerLibrary
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
  // creator status decides whether Settings shows the analytics + studio rows
  const creatorDash = useQuery(
    anyApi.creators.dashboard,
    signedIn ? {} : "skip",
  ) as { creator: unknown; curator: boolean } | null | undefined;

  const runtimeCfg = useQuery(anyApi.runtime.get) as
    | {
        gateFreeSwipes: number;
        moodStrength: number;
        modelStrength: number;
        // absent from a server older than the India/global split
        indiaSharePct?: number;
        pickedLangPct?: number;
        minAndroidVersionCode?: number;
      }
    | null
    | undefined;

  // the two dials for the client-side signals; offline the client defaults hold
  useEffect(() => {
    if (!runtimeCfg) return;
    setStrengths(
      runtimeCfg.moodStrength,
      runtimeCfg.modelStrength,
      typeof runtimeCfg.indiaSharePct === "number" && typeof runtimeCfg.pickedLangPct === "number"
        ? { indiaPct: runtimeCfg.indiaSharePct, pickedPct: runtimeCfg.pickedLangPct }
        : undefined,
    );
  }, [runtimeCfg, setStrengths]);

  /**
   * Ask the recommender what it makes of this listener.
   *
   * Fetched once per sign-in rather than subscribed to. `recommend.forMe`
   * reads the asking listener's own swipe log, so a live subscription would
   * recompute on every swipe — dozens of indexed reads per card, to move a
   * ranking that only takes effect when the deck next refills.
   *
   * Failing is silent by design: no affinity leaves the deck ranked the way it
   * was before any of this existed.
   */
  const convex = useConvex();
  const affinityFor = useRef<string | null>(null);
  useEffect(() => {
    const uid = session.data?.user?.id ?? null;
    if (!uid) {
      affinityFor.current = null;
      return;
    }
    if (affinityFor.current === uid) return;
    affinityFor.current = uid;
    let live = true;
    void convex
      .query(anyApi.recommend.forMe, {})
      .then((result: { strength: number; scores: { trackId: string; score: number }[] } | null) => {
        if (!live || !result) return;
        const scores: Record<string, number> = {};
        for (const row of result.scores) scores[row.trackId] = row.score;
        applyAffinity(scores, result.strength);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [convex, session.data?.user?.id, applyAffinity]);

  /**
   * What the catalogue's listeners have said songs feel like.
   *
   * One shot, like affinity: a stranger pressing a face three time zones away
   * is not a reason to re-rank the card under this listener's thumb. Their own
   * labels come with it, so the face they picked is still lit when the song
   * comes round on another device.
   */
  const crowdFetched = useRef<string | null>(null);
  useEffect(() => {
    // keyed on the backend's view too: the listener's own votes can only be
    // read once Convex holds their token, which lands after the session does
    const key = `${session.data?.user?.id ?? "guest"}:${profileStage}`;
    if (crowdFetched.current === key) return;
    crowdFetched.current = key;
    let live = true;
    void convex
      .query(anyApi.moods.crowd, {})
      .then((rows: { trackId: string; counts: { mood: string; n: number }[] }[] | null) => {
        if (!live || !rows) return;
        const crowd: CrowdMoods = {};
        for (const row of rows) {
          const counts: Partial<Record<MoodId, number>> = {};
          for (const c of row.counts) {
            const mood = coerceMood(c.mood);
            if (mood) counts[mood] = c.n;
          }
          if (Object.keys(counts).length > 0) crowd[row.trackId] = counts;
        }
        applyCrowdMoods(crowd);
      })
      .catch(() => undefined);
    if (session.data?.user?.id && profileStage === "ready") {
      void convex
        .query(anyApi.moods.mine, {})
        .then((rows: { trackId: string; mood: string }[] | null) => {
          if (!live || !rows) return;
          const picks: Record<string, MoodId> = {};
          for (const row of rows) {
            const mood = coerceMood(row.mood);
            if (mood) picks[row.trackId] = mood;
          }
          applyMoodPicks(picks);
        })
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [convex, session.data?.user?.id, profileStage, applyCrowdMoods, applyMoodPicks]);

  /**
   * A face was picked on the ring: switch the deck to that mood.
   *
   * It is a mode switch, not a rating. It used to also vote that the song
   * being held "felt like" the face, which read wrongly to people (they were
   * choosing what to hear next, not judging this song) and wrote wrong data —
   * pick "party" while a ballad is on screen and the ballad got a party vote.
   */
  const pickMood = useCallback((mood: MoodId) => setMood(mood), [setMood]);

  /** The clock, when they asked it to decide rather than to offer. */
  const [daypart, setDaypart] = useState(() => daypartAt());
  useEffect(() => {
    const id = setInterval(() => setDaypart(daypartAt()), 5 * 60_000);
    return () => clearInterval(id);
  }, []);
  const autoApplied = useRef<string | null>(null);
  useEffect(() => {
    if (state.prefs.moodByTime !== "always") return;
    if (autoApplied.current === daypart) return;
    autoApplied.current = daypart;
    setMood(DAYPART_MOOD[daypart]);
  }, [daypart, state.prefs.moodByTime, setMood]);

  const deckTrack = state.queue[0] ?? null;
  const deckVerdict = useMemo(() => {
    if (!deckTrack) return null;
    const v = verdictFor(model, deckTrack, state.crowdMoods);
    // the labels can't hear; when the sound taste clearly agrees, say so
    if (sound && sound.confidence >= 0.5 && soundScore(sound, deckTrack) > 0.35) {
      return { ...v, reasons: [...v.reasons, "sounds like what you keep"].slice(0, 3) };
    }
    return v;
  }, [model, sound, deckTrack, state.crowdMoods]);

  // The catalogue comes as a versioned file over HTTP, stored per version
  // (src/lib/useCatalog.ts), not as a reactive query: as the first message on
  // the websocket its 2 MB held up everything queued behind it. The catalogue
  // itself, not just the ids — ids alone meant the app kept dealing its bundled
  // copies. An empty catalogue is still a REAL state (admin hid everything).
  const onCatalog = useCallback(
    (tracks: CatalogTrack[]) => applyCatalog(tracks.map(toLocalCatalog)),
    [applyCatalog],
  );
  useCatalog(onCatalog);

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
    "ok" | "pending" | "rejected" | "none" | "unverified" | null
  >(null);
  // bumped by "I've confirmed it" to ask the server again
  const [accessCheck, setAccessCheck] = useState(0);
  useEffect(() => {
    if (profileStage === "signed-out") {
      setAccessState(null);
      return;
    }
    if (profileStage === "waiting") return; // the backend hasn't got the token yet
    void ensureProfile({})
      .then(() => setAccessState("ok"))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("ACCESS_PENDING")) setAccessState("pending");
        else if (message.includes("ACCESS_REJECTED")) setAccessState("rejected");
        else if (message.includes("ACCESS_NOT_REQUESTED")) setAccessState("none");
        else if (message.includes("EMAIL_UNVERIFIED")) setAccessState("unverified");
        else setAccessState(null); // a network blip is not a rejection
      });
  }, [profileStage, ensureProfile, accessCheck]);

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
        await deleteAccountMutation(DELETE_ACCOUNT_ARGS);
      } catch (err) {
        notify(
          `Could not delete the account — ${err instanceof Error ? err.message : "try again in a moment"}`,
          "error",
        );
        return;
      }
      resetLocal();
      await AsyncStorage.removeItem(ANON_SWIPES_KEY).catch(() => undefined);
      anonSwipeCount.current = 0;
      await authClient.signOut().catch(() => undefined);
      setStack(["home"]);
      notify("Account deleted — everything tied to it is gone.", "success");
    })();
  }, [deleteAccountMutation, resetLocal, notify]);

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

  /**
   * The wall a guest meets — the invite application, as on the web. "save" is
   * a swipe down (saving needs an account), "limit" is the free swipes spent.
   */
  const [gate, setGate] = useState<"save" | "limit" | null>(null);

  /** The login wall refuses BEFORE anything commits — web parity. */
  const gateSwipe = useCallback(
    (dir: SwipeDir): boolean => {
      if (signedIn) return true;
      const action = DIR_TO_ACTION[dir];
      if (action === "save") {
        setGate("save");
        return false;
      }
      // the wall's distance is live config (gateFreeSwipes) — admins move it
      // without a release; 5 covers the moment before the query first answers
      if (anonSwipeCount.current >= (runtimeCfg?.gateFreeSwipes ?? FREE_SWIPES)) {
        setGate("limit");
        return false;
      }
      anonSwipeCount.current += 1;
      void AsyncStorage.setItem(ANON_SWIPES_KEY, String(anonSwipeCount.current));
      return true;
    },
    [signedIn, runtimeCfg],
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
          // the playlist's own rules and mood; dropping them here reset every
          // playlist's rules to off on the phone after each sign-in
          allowRepeats: p.allowRepeats,
          includeBuried: p.includeBuried,
          includeBlockedArtists: p.includeBlockedArtists,
          mood: coerceMood(p.mood) ?? undefined,
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
  }, [state.prefs.adsOptOut, state.prefs.adFrequency, state.prefs.adCadence, adsConfig]);

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

  // ----- promoted songs: an artist paid for listeners (src/lib/promoted.ts) -----
  // Same as web: ask every N swipes, the server owns the caps. The phone only
  // ever shows the labelled card; it never links to buying promotion.
  const recordPromoted = useMutation(anyApi.promotions.recordPromoted);
  const promoSwipes = useRef(0);
  const promoEvery = useRef(10);
  const [promoDue, setPromoDue] = useState(false);
  const pendingPromo = useRef<Track | null>(null);
  const promoPick = useQuery(
    anyApi.promotions.nextPromoted,
    promoDue
      ? {
          anonKey: anonKeyRef.current ?? undefined,
          // targeted campaigns go to listeners who fit (same as web)
          mood: state.mood,
          genres: [...state.taste.genres, ...state.boostGenres],
        }
      : "skip",
  ) as
    | { campaignId: string; everyNCards: number; track: ServerCatalogTrack }
    | null
    | undefined;
  useEffect(() => {
    if (!promoDue || promoPick === undefined) return;
    setPromoDue(false);
    promoSwipes.current = 0;
    if (!promoPick) return;
    promoEvery.current = promoPick.everyNCards;
    const promoted = { ...toLocalCatalog(promoPick.track), promotedCampaignId: promoPick.campaignId };
    pendingPromo.current = promoted;
    injectNext(promoted);
    void recordPromoted({
      campaignId: promoPick.campaignId,
      anonKey: anonKeyRef.current ?? undefined,
      event: "shown",
    }).catch(() => undefined);
  }, [promoDue, promoPick, injectNext, recordPromoted]);
  const noteSwipeForPromoted = useCallback(() => {
    promoSwipes.current += 1;
    if (promotedDue({ swipesSince: promoSwipes.current, everyNCards: promoEvery.current, optedOut: state.prefs.adsOptOut })) {
      setPromoDue(true);
    }
  }, [state.prefs.adsOptOut]);

  // a rebuild behind the card on screen must not lose a paid song (src/lib/promoted.ts)
  useEffect(() => {
    const step = promotedFollowUp(state.queue.map((t) => t.id), pendingPromo.current?.id ?? null);
    if (step === "clear") pendingPromo.current = null;
    else if (step === "reinject" && pendingPromo.current) injectNext(pendingPromo.current);
  }, [state.queue, injectNext]);

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
    // nothing saved on a fresh install must mean full volume, not muted
    void AsyncStorage.getItem(VOLUME_KEY).then((v) => {
      const n = storedVolume(v);
      setVolumeState(n);
      player.volume = n;
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
  const currentTimeRef = useRef(0);
  currentTimeRef.current = status.currentTime;
  const moodRef = useRef(state.mood);
  moodRef.current = state.mood;
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
      noteSwipeForPromoted();
      // a play inside a sponsored deck, while its mood is still on (counts only)
      const ds = deckSession.current;
      if (ds && (ds.mood === null || ds.mood === moodRef.current) && ds.plays < DECK_PLAYS_PER_SESSION) {
        ds.plays += 1;
        deckEventRef.current(ds.id, "play");
      } else if (ds) {
        deckSession.current = null;
      }
      const track = onDeck;
      const action = DIR_TO_ACTION[dir];
      if (track?.promotedCampaignId) {
        void recordPromoted({
          campaignId: track.promotedCampaignId,
          anonKey: anonKeyRef.current ?? undefined,
          event: promotedOutcome(dir),
        }).catch(() => undefined);
      }
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
          {
            track: toServer(track),
            action,
            ...(hookId ? { hookId } : {}),
            // for the artist's free insights: where in the hook, and in what mood
            ...insightContext(
              playing?.durationMs,
              playing ? (currentTimeRef.current * 1000 - playing.startMs) / playing.durationMs : Number.NaN,
              moodRef.current,
            ),
          },
          recordSwipeMutation,
        );
      }
    },
    [swipe, onDeck, signedIn, recordSwipeMutation, syncWrite, noteSwipeForAds, noteSwipeForPromoted, recordPromoted],
  );

  // a promoted card counts as heard after 3 s of actual playing (as on web)
  const promotedOnDeck = onDeck?.promotedCampaignId;
  const promotedPlaying = status.playing;
  useEffect(() => {
    if (!promotedOnDeck || !promotedPlaying) return;
    const t = setTimeout(() => {
      void recordPromoted({
        campaignId: promotedOnDeck,
        anonKey: anonKeyRef.current ?? undefined,
        event: "listen",
        playedMs: PROMOTED_LISTEN_MS,
      }).catch(() => undefined);
    }, PROMOTED_LISTEN_MS);
    return () => clearTimeout(t);
  }, [promotedOnDeck, promotedPlaying, recordPromoted]);

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

  // ----- hook of the day: Home card + the daily local notification -----
  const libraryIds = useMemo(
    () =>
      new Set(
        [...state.liked, ...state.discoveries, ...state.playlists.flatMap((p) => p.tracks)].map((t) => t.id),
      ),
    [state.liked, state.discoveries, state.playlists],
  );
  const hotdSettings = useNotifySettings();
  const hookOfDay = useHookOfDay(state.queue, state.catalog, libraryIds);
  const goDiscoverRef = useRef(goDiscover);
  goDiscoverRef.current = goDiscover;
  useEffect(() => {
    installForegroundHandler();
    return onHookNotificationTap((id) => goDiscoverRef.current(id));
  }, []);
  // reschedule the week ahead on every app open (and when the time, the
  // switch or the language changes) so the picks follow the listener's taste
  const scheduleInput = useRef({ queue: state.queue, libraryIds });
  scheduleInput.current = { queue: state.queue, libraryIds };
  useEffect(() => {
    if (!state.hydrated) return;
    // after the Home card has settled today's pick, so both agree
    const id = setTimeout(() => {
      const { queue, libraryIds: exclude } = scheduleInput.current;
      void scheduleHookNotifications(queue, exclude, hotdSettings, {
        title: tx("Your hook of the day is ready"),
      }).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(id);
  }, [state.hydrated, hotdSettings, tx]);

  // ----- Home: indie hook of the week, sponsored decks (src/lib/features.ts) -----
  const featured = useQuery(anyApi.featured.current) as
    | { week: string; blurb: string; track: ServerCatalogTrack }
    | null
    | undefined;
  const liveDecks = useQuery(anyApi.sponsoredDecks.live) as LiveDeck[] | undefined;
  const recordDeck = useMutation(anyApi.sponsoredDecks.record);
  const deckSession = useRef<{ id: string; mood: string | null; plays: number } | null>(null);
  const deckSeen = useRef(new Set<string>());
  const deckEvent = useCallback(
    (deckId: string, event: "impression" | "open" | "play") =>
      void recordDeck({ deckId, event, anonKey: anonKeyRef.current ?? undefined }).catch(() => undefined),
    [recordDeck],
  );
  // the swipe handler is declared above this and reads the latest one through a ref
  const deckEventRef = useRef(deckEvent);
  deckEventRef.current = deckEvent;
  useEffect(() => {
    if (screen !== "home" || !liveDecks) return;
    for (const d of liveDecks) {
      if (deckSeen.current.has(d.id)) continue;
      deckSeen.current.add(d.id);
      deckEvent(d.id, "impression");
    }
  }, [screen, liveDecks, deckEvent]);
  const playFeatured = useCallback(
    (track: Track) => {
      if (state.catalog.some((t) => t.id === track.id) || state.queue.some((t) => t.id === track.id)) jumpTo(track.id);
      else injectNext(track);
      switchTab("discover");
    },
    [state.catalog, state.queue, jumpTo, injectNext, switchTab],
  );
  const openDeck = useCallback(
    (deck: LiveDeck) => {
      deckEvent(deck.id, "open");
      deckSession.current = { id: deck.id, mood: deck.mood, plays: 0 };
      if (deck.mood) setMood(deck.mood as MoodId);
      const first = deckTracks(state.catalog, deck);
      for (const t of [...first].reverse().slice(0, -1)) injectNext(t);
      if (first[0]) jumpTo(first[0].id);
      switchTab("discover");
    },
    [deckEvent, setMood, state.catalog, injectNext, jumpTo, switchTab],
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
      mood?: MoodId | null,
    ): Promise<string> => {
      let id = `local-${Date.now()}`;
      if (signedIn) {
        try {
          id = String(
            await createPlaylistMutation({ name, accent, ...rules, ...(mood ? { mood } : {}) }),
          );
        } catch {
          /* keep local id */
        }
      }
      createPlaylist({ id, name, accent, tracks: [], ...rules, ...(mood ? { mood } : {}) });
      return id;
    },
    [signedIn, createPlaylistMutation, createPlaylist],
  );

  /**
   * Hold the +, push toward a face, release: that mood's playlist is created
   * (or found), made the swipe-down target and the deck's lens — so every song
   * kept fills it. Same behaviour as the web app.
   */
  const screenSize = useWindowDimensions();
  const [plusRing, setPlusRing] = useState<{ x: number; y: number } | null>(null);
  const [plusAim, setPlusAim] = useState<MoodId | null>(null);
  const [plusHolding, setPlusHolding] = useState(false);
  const closePlusRing = useCallback(() => {
    setPlusRing(null);
    setPlusAim(null);
    setPlusHolding(false);
  }, []);
  const makeMoodPlaylist = useCallback(
    async (mood: MoodId) => {
      const face = moodById(mood);
      if (!face) return;
      const name = moodPlaylistName(mood);
      const existing = state.playlists.find(
        (p) => p.name.trim().toLowerCase() === name.toLowerCase(),
      );
      const id = existing ? existing.id : await handleCreatePlaylist(name, face.accent, undefined, mood);
      handleSaveTarget(`pl:${id}`);
      setMood(mood);
      switchTab("discover");
    },
    [state.playlists, handleCreatePlaylist, handleSaveTarget, setMood, switchTab],
  );
  // release commits what the finger pointed at; a release in the dead zone
  // leaves the ring up to be tapped, like the card ring
  const plusWasHolding = useRef(false);
  useEffect(() => {
    if (plusWasHolding.current && !plusHolding && plusAim) {
      const mood = plusAim;
      closePlusRing();
      void makeMoodPlaylist(mood);
    }
    plusWasHolding.current = plusHolding;
  }, [plusHolding, plusAim, closePlusRing, makeMoodPlaylist]);

  /** FAB flow: create the playlist AND make it the swipe-down destination. */
  const handleCreateAndTarget = useCallback(
    async (
      name: string,
      accent: string,
      rules?: { allowRepeats?: boolean; includeBuried?: boolean; includeBlockedArtists?: boolean },
      mood?: MoodId | null,
    ) => {
      const id = await handleCreatePlaylist(name, accent, rules, mood);
      handleSaveTarget(`pl:${id}`);
      if (mood) {
        // made for a mood: the lens goes on and the deck opens, the same as
        // holding the + for it
        setMood(mood);
        switchTab("discover");
      }
    },
    [handleCreatePlaylist, handleSaveTarget, setMood, switchTab],
  );

  /** "Discover into this": point saves at the container, then go swipe. */
  const handleDiscoverInto = useCallback(
    (container: LibraryContainer) => {
      handleSaveTarget(container as SaveTarget);
      // a mood playlist brings its lens with it, so what fills it still fits
      const pl = container.startsWith("pl:")
        ? state.playlists.find((p) => p.id === container.slice(3))
        : undefined;
      if (pl?.mood) setMood(pl.mood);
      switchTab("discover");
    },
    [handleSaveTarget, switchTab, state.playlists, setMood],
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
    // the same card and the same four answers as the web app's AccessPending
    return (
      <View style={styles.root}>
        <AccessPending
          reason={accessState}
          email={session.data?.user?.email ?? "your email"}
          onRecheck={() => setAccessCheck((n) => n + 1)}
        />
      </View>
    );
  }

  if (!onboarded) {
    return (
      <Onboarding
        demoTracks={demoTracks}
        demoCatalog={state.catalog}
        onFinish={(taste, firstMood) => {
          void AsyncStorage.setItem(ONBOARD_KEY, "1");
          // apply locally first so the very first deck is already tilted; the
          // server copy is for the next device they sign in on
          setTaste(taste);
          // the mood picked in the tour opens the deck — the point of asking then
          if (firstMood) setMood(firstMood);
          if (signedIn) syncWrite("setTaste", { ...taste }, setTasteMutation);
          setOnboarded(true);
          setStack(["discover"]);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* overlays that must cover the whole screen (the deck's mood wheel) */}
      <BlurTarget.Provider value={blurTarget}>
      <PortalHost>
      {/* Android blurs only what is inside a BlurTargetView: the screen is,
          and every overlay below it (and the portal layer) is drawn after */}
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
      {screen === "home" && (
        <>
          <View style={styles.topbar}>
            <Pressable
              style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
              onPress={() => push("profile")}
              accessibilityRole="button"
              accessibilityLabel={signedIn ? "Your profile" : "Sign in"}
            >
              <Feather
                name="user"
                size={18}
                color={signedIn ? accent : colors.text}
              />
            </Pressable>
            <Text style={styles.wordmark}>
              HookedCue<Text style={{ color: accent }}>.</Text>
            </Text>
            <Pressable
              style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
              onPress={() => push("settings")}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Feather name="settings" size={18} color={colors.text} />
            </Pressable>
          </View>
          <HomeScreen
            accent={accent}
            featured={featured ? { blurb: featured.blurb, track: toLocalCatalog(featured.track) } : null}
            onPlayFeatured={playFeatured}
            decks={liveDecks ?? []}
            onOpenDeck={openDeck}
            onDiscover={goDiscover}
            onOpenLibrary={(c) => push(`library:${c}`)}
            onNewPlaylist={() => setNewPlaylistOpen(true)}
            hookOfDay={hotdSettings.showOnHome ? hookOfDay : null}
            onPlayHookOfDay={(t) => goDiscover(t.id)}
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
              accessibilityRole="button"
              accessibilityLabel="Back to the last song"
            >
              {previous && (
                <Image
                  source={{ uri: art(previous.artwork, 100) }}
                  style={styles.topBtnArt}
                />
              )}
              <Feather name="corner-up-left" size={18} color={colors.text} />
            </Pressable>
            {(() => {
              // playing a saved list: the wordmark becomes "Liked Songs · 3 of 12";
              // tapping it goes back to discovering
              const pos = sessionPosition(state.session, state.queue[0]?.id);
              if (!state.session || !pos) {
                return (
                  <Text style={styles.wordmark}>
                    HookedCue<Text style={{ color: accent }}>.</Text>
                  </Text>
                );
              }
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.sessionPill,
                    { backgroundColor: withAlpha(accent, 0.14), borderColor: withAlpha(accent, 0.45) },
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                  onPress={endSession}
                  accessibilityRole="button"
                  accessibilityLabel={tx("Stop playing {title}", { title: state.session.title })}
                >
                  <Feather name="play" size={11} color={accent} />
                  <Text style={styles.sessionPillTitle} numberOfLines={1}>
                    {state.session.title}
                  </Text>
                  <Text style={styles.sessionPillCount}>
                    {tx("{i} of {n}", { i: pos.index, n: pos.total })}
                  </Text>
                  <Feather name="x" size={12} color={colors.muted} />
                </Pressable>
              );
            })()}
            <Pressable
              style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
              onPress={() => setSaveSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Where saves go"
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
            activeMood={state.mood}
            pickedMood={null}
            verdict={deckVerdict}
            onPickMood={pickMood}
            onClearMood={() => setMood(null)}
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
        </>
      )}

      {screen === "profile" && (
        <ProfileScreen
          accent={accent}
          onBack={pop}
          onPlay={(id) => goDiscover(id)}
        />
      )}

      {screen === "stats" && <StatsScreen onBack={pop} />}

      {screen === "settings" && (
        <SettingsScreen
          onBack={pop}
          onOpenStats={() => push("stats")}
          onOpenProfile={() => push("profile")}
          signedIn={signedIn}
          email={session.data?.user?.email ?? null}
          canViewStats={signedIn && (library?.isAdmin === true || creatorDash?.creator != null || creatorDash?.curator === true)}
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
      {screen === "settings:language" && <LanguagePage onBack={pop} />}
      {screen === "settings:support" && <SupportPage onBack={pop} />}
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
          onPlay={(s) => {
            startSession({ container: screen.slice(8), ...s });
            // pushed, not a tab switch: back returns to the list
            push("discover");
          }}
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
        onHoldStart={(x, y) => {
          setPlusAim(null);
          setPlusHolding(true);
          setPlusRing({ x, y });
        }}
        onHoldMove={(dx, dy) => setPlusAim(moodAtPush(dx, dy, 38, PLUS_DOWN_GAIN))}
        onHoldEnd={() => setPlusHolding(false)}
      />

      </BlurTargetView>

      {plusRing && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <MoodWheel
            origin={plusRing}
            host={{ x: 0, y: 0, width: screenSize.width, height: screenSize.height }}
            aim={plusAim}
            picked={null}
            active={state.mood}
            verdict={null}
            dragging={plusHolding}
            motionPref={state.prefs.motion}
            hint="pick a mood — a playlist that fills as you keep songs"
            onCommit={(mood) => {
              closePlusRing();
              void makeMoodPlaylist(mood);
            }}
            onCancel={closePlusRing}
          />
        </View>
      )}

      {gate && !signedIn && (
        <AccessGate
          freeSwipes={runtimeCfg?.gateFreeSwipes ?? FREE_SWIPES}
          accent={accent}
          onClose={() => setGate(null)}
        />
      )}

      {/* updates: an over-the-air bundle ready to apply, or a newer build on Google Play */}
      <UpdateBanner minVersionCode={runtimeCfg?.minAndroidVersionCode ?? 0} />

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
          onCreate={(name, swatch, rules, mood) => void handleCreateAndTarget(name, swatch, rules, mood)}
          onClose={() => setNewPlaylistOpen(false)}
        />
      )}

      {fullSongOpen && onDeck && (
        <FullSongSheet track={onDeck} anonKey={anonKeyRef.current} onClose={() => setFullSongOpen(false)} />
      )}

      <StatusBar style="light" />
      </PortalHost>
      </BlurTarget.Provider>
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
        {/* cast at this one boundary: the adapter declares the prop's session
            as `never`; the app's own session types stay intact elsewhere */}
        <ConvexBetterAuthProvider
          client={convex}
          authClient={authClient as unknown as ComponentProps<typeof ConvexBetterAuthProvider>["authClient"]}
        >
          {/* inside the providers, so recovering keeps the session and store */}
          <AppErrorBoundary>
            <LangProvider>
              <StoreProvider>
                <DialogProvider>
                  <Shell />
                </DialogProvider>
              </StoreProvider>
            </LangProvider>
          </AppErrorBoundary>
        </ConvexBetterAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
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
  sessionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    maxWidth: "62%",
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  sessionPillTitle: { fontFamily: fonts.displayBold, fontSize: 12.5, color: colors.text, flexShrink: 1 },
  sessionPillCount: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted },
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







