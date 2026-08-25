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
}

export type LibraryContainer = "liked" | "discoveries" | `pl:${string}`;

export const DIR_TO_ACTION: Record<SwipeDir, SwipeAction> = {
  up: "skip",
  down: "save",
  right: "more",
  left: "never",
};

