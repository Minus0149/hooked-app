import Svg, { Circle, Path } from "react-native-svg";
import type { MoodId } from "../data/mood";

/**
 * Six faces, drawn — the same six as web/src/components/faces.tsx, the same
 * geometry, in react-native-svg.
 *
 * Emoji would have been one line and the wrong answer twice over: the glyphs
 * differ between Android versions and iOS, and they arrive in somebody else's
 * colours in the middle of a deliberately dark room. These take the mood's own
 * colour, and a face means the same thing on both surfaces.
 */

interface FaceProps {
  mood: MoodId;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Face({ mood, size = 28, color, strokeWidth = 1.7 }: FaceProps) {
  const stroke = color ?? "#F4F2EE";
  const common = {
    stroke,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  const solid = { fill: stroke };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9.2" {...common} />
      {mood === "hyped" && (
        <>
          <Path d="M7 8.6 9.9 10" {...common} />
          <Path d="M17 8.6 14.1 10" {...common} />
          <Path d="M8.6 14.2h6.8a3.4 3.4 0 0 1-6.8 0Z" {...solid} />
        </>
      )}
      {mood === "party" && (
        <>
          <Path d="M7.4 10.4a1.9 1.9 0 0 1 3 0" {...common} />
          <Path d="M13.6 10.4a1.9 1.9 0 0 1 3 0" {...common} />
          <Path d="M7.7 13.8a5 5 0 0 0 8.6 0" {...common} />
          <Path d="M20.4 4.6v2.2M19.3 5.7h2.2" {...common} />
        </>
      )}
      {mood === "sunny" && (
        <>
          <Circle cx="9.1" cy="10.2" r="1.05" {...solid} />
          <Circle cx="14.9" cy="10.2" r="1.05" {...solid} />
          <Path d="M8.2 14a4.6 4.6 0 0 0 7.6 0" {...common} />
        </>
      )}
      {mood === "chill" && (
        <>
          <Path d="M7.8 10.6h2.4" {...common} />
          <Path d="M13.8 10.6h2.4" {...common} />
          <Path d="M9.2 14.6a3.4 3.4 0 0 0 5.6 0" {...common} />
        </>
      )}
      {mood === "tender" && (
        <>
          <Circle cx="9.1" cy="10" r="1.05" {...solid} />
          <Circle cx="14.9" cy="10" r="1.05" {...solid} />
          <Path d="M9.3 15.4a3.6 3.6 0 0 1 5.4 0" {...common} />
          <Path
            d="M9.1 12.2c0 1.5-1 1.9-1 2.9a1 1 0 0 0 2 0c0-1-1-1.4-1-2.9Z"
            {...solid}
          />
        </>
      )}
      {mood === "sleepy" && (
        <>
          <Path d="M7.6 10.8a1.9 1.9 0 0 0 3 0" {...common} />
          <Path d="M13.4 10.8a1.9 1.9 0 0 0 3 0" {...common} />
          <Circle cx="12" cy="15" r="1.3" {...common} />
          <Path d="M18.6 3.4h2.6l-2.6 3h2.6" {...common} />
        </>
      )}
    </Svg>
  );
}
