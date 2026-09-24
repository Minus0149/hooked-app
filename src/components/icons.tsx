import Svg, { Path } from "react-native-svg";

/**
 * The few glyphs Feather doesn't have, drawn with the same paths as
 * web/src/components/icons.tsx so both apps show the same mark for the same
 * action. "More like this" is a sparkle on both — it was a lightning bolt here.
 */
export function Sparkle({
  size = 20,
  color,
  strokeWidth = 1.8,
}: {
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5 13.8 9 19.5 11l-5.7 2-1.8 5.5L10.2 13 4.5 11l5.7-2L12 3.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
