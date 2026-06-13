// Shared design tokens — keep in sync with web/src/design/tokens.ts
export const colors = {
  bg: "#08080C",
  surface: "#13131B",
  surface2: "#1C1C26",
  line: "#26262F",
  text: "#F4F2EE",
  muted: "#8E8C99",
  accentDefault: "#FF3D71",
  save: "#00E5A0",
  never: "#FF5252",
  more: "#FFB627",
  // dark ink used for glyphs/text sitting on light or accent surfaces
  ink: "#0B0B10",
  // card scrim gradient stops (web .card-scrim)
  scrimFade: "rgba(5,5,9,0)",
  scrimTop: "rgba(5,5,9,0.35)",
  scrimBottom: "rgba(5,5,9,0.92)",
  stampBg: "rgba(5,5,9,0.55)",
  artistDim: "rgba(244,242,238,0.82)",
  // gesture FX tints
  moreGlow: "rgba(255,182,39,0.12)",
  neverGlow: "rgba(255,82,82,0.16)",
  // bottom sheets
  backdrop: "rgba(3,3,5,0.6)",
};

// Append an alpha channel to a #RRGGBB hex — RN's stand-in for CSS color-mix
// against transparent.
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return hex.length === 7 ? `${hex}${a}` : hex;
}

// Blend two #RRGGBB hexes — RN's stand-in for CSS color-mix(a t%, b).
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1, 7), 16);
  const pb = parseInt(b.slice(1, 7), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 0xff) * t + ((pb >> shift) & 0xff) * (1 - t));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

// Playlist accent palette — keep in sync with web's NewPlaylistSheet SWATCHES
export const PLAYLIST_SWATCHES = [
  "#FF3D71",
  "#7C5CFF",
  "#00C2FF",
  "#00E5A0",
  "#FFB627",
  "#FF6B35",
  "#E040FB",
];

// Unbounded for display, Instrument Sans for body — loaded via expo-font in App.tsx.
// RN ignores fontWeight with custom fonts on Android, so each weight is its own family.
export const fonts = {
  display: "Unbounded_900Black",
  displayBold: "Unbounded_700Bold",
  body: "InstrumentSans_400Regular",
  bodyMedium: "InstrumentSans_500Medium",
  bodySemiBold: "InstrumentSans_600SemiBold",
  bodyBold: "InstrumentSans_700Bold",
};

export const gesture = {
  commitDistance: 90, // px before a drag commits to an action
  commitVelocity: 650, // px/s flick that commits regardless of distance
  axisDominance: 1.35, // dominant axis must exceed the other by this ratio
};

export const radii = { card: 28, tile: 20, pill: 999 };
