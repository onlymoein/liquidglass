import { createContext, Fragment, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

// What floats over the whole screen, as a menu does on iOS, rather than pushing the page about.
// On Android the outermost Backdrop puts a layer just after itself, over what it holds, and glass
// in that layer shows the whole page through it: the cards, the buttons and what's behind them.

/** Where something is on the screen, in points from the top left of the app. */
export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Overlay {
  /** Shows `node` over the page, in place of what was shown under `key` before. */
  show(key: string, node: ReactNode): void;
  hide(key: string): void;
  /** Where the layer is, which is where what's shown on it is placed from. */
  measure(): Promise<Frame | null>;
}

const Context = createContext<Overlay | null>(null);

/** The layer over the page, or null when nothing has put one there. */
export const useOverlay = () => useContext(Context);

type ViewRef = React.ComponentRef<typeof View>;

/** Where a view is on the screen, as touches report where they are. */
export const frameOf = (view: ViewRef | null): Promise<Frame | null> =>
  new Promise((resolve) => {
    if (!view) return resolve(null);
    view.measure((_x: number, _y: number, width: number, height: number, x: number, y: number) => resolve(width || height ? { x, y, width, height } : null));
  });

/** Puts a layer over `children`, unless something round them already has. */
export function OverlayHost({ children }: { children: ReactNode }) {
  const outer = useContext(Context);
  const ref = useRef<ViewRef>(null);
  const [layers, setLayers] = useState<ReadonlyMap<string, ReactNode>>(new Map());
  const overlay = useMemo<Overlay>(
    () => ({
      show: (key, node) => setLayers((now) => new Map(now).set(key, node)),
      hide: (key) =>
        setLayers((now) => {
          if (!now.has(key)) return now;
          const next = new Map(now);
          next.delete(key);
          return next;
        }),
      measure: () => frameOf(ref.current),
    }),
    []
  );
  if (outer) return <>{children}</>;
  return (
    <>
      <Context.Provider value={overlay}>{children}</Context.Provider>
      <View ref={ref} collapsable={false} pointerEvents="box-none" style={styles.layer}>
        {[...layers].map(([key, node]) => (
          <Fragment key={key}>{node}</Fragment>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1000 },
});
