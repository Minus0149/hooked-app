import type { MoodId } from "./data/mood";
/**
 * A window into a track's audio. A 30-second preview holds three of them; a
 * full upload holds as many as the artist marks.
 */
export interface HookWindow {
  id: string;
  startMs: number;
  durationMs: number;
  label?: string;
}

export interface Track {
  id: string;
  /** set when this card is a paid promotion: its campaign (lib/promoted.ts) */
  promotedCampaignId?: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  previewUrl: string;
  durationMs: number;
  genre: string;
  accent: string;
  /** full audio uploaded by the rights holder, when there is one */
  audioUrl?: string;
  /** ordered best-first by the server; absent means "play the whole preview" */
  hooks?: HookWindow[];
  /** iTunes storefronts this charted in — the language signal */
  markets?: string[];
  /** play count normalised 0..1 against the catalogue's leader (hourly job) */
  heat?: number;
  /**
   * Measured arousal, 0..1: how activating the recording sounds, from the
   * loudness and onset curves the offline analyser already computes to find
   * hooks. Absent until a track has been analysed.
   */
  energy?: number;
  /**
   * What the recording sounds like: its CLAP audio embedding, projected to 32
   * numbers and packed as signed bytes in base64 (see data/sound.ts). Written
   * by scripts/analyze-sound.mjs; absent until a track has been heard.
   */
  sound?: string;
  /**
   * How the audio reads on each mood, in MOOD_IDS order (hyped, party, sunny,
   * chill, tender, sleepy), summing to ~1 — the model listening, calibrated
   * across the catalogue. Absent until analysed.
   */
  audioMood?: number[];
  /** 0..1, how sung (vs instrumental) the audio is. Absent until analysed. */
  vocal?: number;
}

export type SwipeAction = "skip" | "save" | "more" | "never";
export type SwipeDir = "up" | "down" | "right" | "left";
/** "liked" | "discoveries" | "pl:<playlistId>" */
export type SaveTarget = "liked" | "discoveries" | `pl:${string}`;

export interface Playlist {
  id: string;
  name: string;
  accent: string;
  tracks: Track[];
  /** discovery rules — what the deck may deal while this playlist is the target */
  allowRepeats?: boolean;
  includeBuried?: boolean;
  includeBlockedArtists?: boolean;
  /** the mood it was made for — discovering into it puts that lens back on */
  mood?: MoodId;
}

export type LibraryContainer = "liked" | "discoveries" | `pl:${string}`;

export const DIR_TO_ACTION: Record<SwipeDir, SwipeAction> = {
  up: "skip",
  down: "save",
  right: "more",
  left: "never",
};

