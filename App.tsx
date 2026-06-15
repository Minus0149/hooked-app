import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
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
import { authClient } from "./src/lib/auth-client";
import { StoreProvider, useStore } from "./src/state/store";
import { SwipeDeck } from "./src/components/SwipeDeck";
import { HomeScreen } from "./src/components/HomeScreen";
import { LibraryScreen } from "./src/components/LibraryScreen";
import { SettingsScreen } from "./src/components/SettingsScreen";
import { ProfileScreen } from "./src/components/ProfileScreen";
import { Onboarding } from "./src/components/Onboarding";
import { BottomNav } from "./src/components/BottomNav";
import { SaveTargetSheet } from "./src/components/SaveTargetSheet";
import { NewPlaylistSheet } from "./src/components/NewPlaylistSheet";
import { FullSongSheet } from "./src/components/FullSongSheet";
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
import { CONVEX_URL } from "./src/config/env";

const ONBOARD_KEY = "hooked.onboarded.v1";
const ANON_SWIPES_KEY = "hooked.anonSwipes.v1";
const FREE_SWIPES = 5;

const convex = new ConvexReactClient(CONVEX_URL);

type Screen = "home" | "discover" | "profile" | "settings" | `library:${string}`;

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
  } = useStore();
  const [screen, setScreen] = useState<Screen>("home");
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [fullSongOpen, setFullSongOpen] = useState(false);
  const anonSwipeCount = useRef(0);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
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
  const ensureProfile = useMutation(anyApi.library.ensureProfile);
  const recordSwipe = useMutation(anyApi.library.recordSwipe);
  const revertSwipe = useMutation(anyApi.library.revertSwipe);
  const saveTargetMutation = useMutation(anyApi.library.setSaveTarget);
  const createPlaylistMutation = useMutation(anyApi.library.createPlaylist);
  const deletePlaylistMutation = useMutation(anyApi.library.deletePlaylist);
  const removeSongMutation = useMutation(anyApi.library.removeSong);

  useEffect(() => {
    if (signedIn) void ensureProfile({}).catch(() => undefined);
  }, [signedIn, ensureProfile]);

  useEffect(() => {
    if (signedIn) {
      anonSwipeCount.current = 0;
      void AsyncStorage.removeItem(ANON_SWIPES_KEY);
    }
  }, [signedIn]);

  const promptAuth = useCallback((message: string) => {
    Alert.alert("Create an account", message, [
      { text: "Not now", style: "cancel" },
      { text: "Sign in", onPress: () => setScreen("profile") },
    ]);
  }, []);

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
        saveTarget: library.saveTarget as SaveTarget,
      });
    }
  }, [library, sessionUid, hydrateRemote]);

  const onDeck = state.queue[0] ?? null;
  const previousEntry = state.history.length
    ? state.history[state.history.length - 1]
    : null;
  const previous = previousEntry?.track ?? null;
  const inDiscover = screen === "discover" && onboarded === true;

  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (inDiscover && onDeck) {
      player.replace({ uri: onDeck.previewUrl });
      player.play();
    } else {
      player.pause();
    }
  }, [inDiscover, onDeck?.id]);

  const lastSwipeAt = useRef(0);

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
      const track = onDeck;
      const action = DIR_TO_ACTION[dir];
      if (!signedIn) {
        if (action === "save") {
          promptAuth("Create an account to save songs and playlists across devices.");
          return;
        }
        if (anonSwipeCount.current >= FREE_SWIPES) {
          promptAuth("You've used your 5 free swipes. Sign in to keep discovering and sync your taste.");
          return;
        }
        anonSwipeCount.current += 1;
        void AsyncStorage.setItem(ANON_SWIPES_KEY, String(anonSwipeCount.current));
      }
      swipe(action);
      if (signedIn && track) {
        void recordSwipe({ track: toServer(track), action }).catch(
          () => undefined,
        );
      }
    },
    [swipe, onDeck, signedIn, recordSwipe, promptAuth],
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
      void revertSwipe({
        trackId: previousEntry.track.id,
        artist: previousEntry.track.artist,
        action: previousEntry.action,
      }).catch(() => undefined);
    }
  }, [back, previousEntry, signedIn, revertSwipe]);

  const handleSaveTarget = useCallback(
    (target: SaveTarget) => {
      setSaveTarget(target);
      if (signedIn) void saveTargetMutation({ target }).catch(() => undefined);
    },
    [setSaveTarget, signedIn, saveTargetMutation],
  );

  const handleToggle = useCallback(
    () => (status.playing ? player.pause() : player.play()),
    [status.playing, player],
  );

  const handleSeek = useCallback(
    (fraction: number) => {
      if (status.duration > 0) {
        // arm the guard: scrubbing to the very end fires didJustFinish, and
        // an immediate auto-advance would chain-skip cards under the scrub
        lastSwipeAt.current = Date.now();
        void player.seekTo(fraction * status.duration);
      }
    },
    [player, status.duration],
  );

  const goDiscover = useCallback(
    (trackId?: string) => {
      if (trackId) jumpTo(trackId);
      setScreen("discover");
    },
    [jumpTo],
  );

  const handleCreatePlaylist = useCallback(
    async (name: string, accent: string): Promise<string> => {
      let id = `local-${Date.now()}`;
      if (signedIn) {
        try {
          id = String(await createPlaylistMutation({ name, accent }));
        } catch {
          /* keep local id */
        }
      }
      createPlaylist({ id, name, accent, tracks: [] });
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
      setScreen("discover");
    },
    [handleSaveTarget],
  );

  const handleDeletePlaylist = useCallback(
    (id: string) => {
      deletePlaylist(id);
      if (signedIn && !id.startsWith("local-")) {
        void deletePlaylistMutation({ playlistId: id }).catch(() => undefined);
      }
    },
    [deletePlaylist, signedIn, deletePlaylistMutation],
  );

  const handleRemoveSong = useCallback(
    (trackId: string) => {
      removeSong(trackId);
      if (signedIn) void removeSongMutation({ trackId }).catch(() => undefined);
    },
    [removeSong, signedIn, removeSongMutation],
  );

  const accent = inDiscover && onDeck ? onDeck.accent : colors.accentDefault;
  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;
  const remaining =
    status.duration > 0
      ? Math.max(0, status.duration - status.currentTime)
      : Number.POSITIVE_INFINITY;

  if (onboarded === null || !state.hydrated) {
    return <View style={styles.root} />;
  }

  if (!onboarded) {
    return (
      <Onboarding
        demoTracks={state.queue.slice(3, 8)}
        onFinish={() => {
          void AsyncStorage.setItem(ONBOARD_KEY, "1");
          setOnboarded(true);
          setScreen("discover");
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
              onPress={() => setScreen("profile")}
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
              onPress={() => setScreen("settings")}
            >
              <Feather name="settings" size={18} color={colors.text} />
            </Pressable>
          </View>
          <HomeScreen
            accent={accent}
            onDiscover={goDiscover}
            onOpenLibrary={(c) => setScreen(`library:${c}`)}
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
            onOpenFullSong={() => setFullSongOpen(true)}
            onSwipeStart={handleSwipeStart}
            onSwipe={handleSwipe}
          />
          {/* faint build tag: proves which bundle the device is running */}
          <Text style={styles.buildTag}>{BUILD_TAG}</Text>
        </>
      )}

      {screen === "profile" && (
        <ProfileScreen
          accent={accent}
          onBack={() => setScreen("home")}
          onPlay={(id) => goDiscover(id)}
        />
      )}

      {screen === "settings" && (
        <SettingsScreen
          onBack={() => setScreen("home")}
          onOpenSaveTarget={() => setSaveSheetOpen(true)}
          onReplayTutorial={() => {
            void AsyncStorage.removeItem(ONBOARD_KEY);
            setOnboarded(false);
          }}
          onResetData={() => {
            resetLocal();
            setScreen("home");
          }}
        />
      )}

      {screen.startsWith("library:") && (
        <LibraryScreen
          container={screen.slice(8) as LibraryContainer}
          onBack={() => setScreen("home")}
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
        onChange={(v) => setScreen(v)}
        onCreate={() => setNewPlaylistOpen(true)}
      />

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
          <StoreProvider>
            <Shell />
          </StoreProvider>
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
