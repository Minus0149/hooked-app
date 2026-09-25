import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";

/**
 * A minimal portal: children of <Portal> render in the <PortalHost> layer at
 * the app root instead of where they are declared.
 *
 * The deck's mood wheel needed it. Drawn inside the deck, its dimmed backdrop
 * stopped at the deck's edges — the top bar and the bottom nav stayed bright —
 * and its hint sat over the controls, where the web app (which portals the
 * wheel into the whole phone frame) puts it along the bottom of the screen.
 */
type Layer = { mount: (key: string, node: ReactNode) => void; unmount: (key: string) => void };

const PortalLayer = createContext<Layer | null>(null);

export function PortalHost({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<Record<string, ReactNode>>({});
  const mount = useCallback(
    (key: string, node: ReactNode) => setNodes((n) => ({ ...n, [key]: node })),
    [],
  );
  const unmount = useCallback(
    (key: string) =>
      setNodes((n) => {
        if (!(key in n)) return n;
        const next = { ...n };
        delete next[key];
        return next;
      }),
    [],
  );
  const layer = useMemo(() => ({ mount, unmount }), [mount, unmount]);
  const entries = Object.entries(nodes);
  return (
    <PortalLayer.Provider value={layer}>
      {children}
      {entries.length > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {entries.map(([key, node]) => (
            <View key={key} style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {node}
            </View>
          ))}
        </View>
      )}
    </PortalLayer.Provider>
  );
}

/** True when a PortalHost is above this component (so <Portal> lifts). */
export function usePortalAvailable(): boolean {
  return useContext(PortalLayer) !== null;
}

/** Renders its children in the root layer; inline when there is no host. */
export function Portal({ children }: { children: ReactNode }) {
  const layer = useContext(PortalLayer);
  const key = useId();
  useEffect(() => {
    layer?.mount(key, children);
  }, [layer, key, children]);
  useEffect(() => () => layer?.unmount(key), [layer, key]);
  return layer ? null : <>{children}</>;
}
