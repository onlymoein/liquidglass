import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { Button, Glyph, NativeTrack, fills, hasGlyph, useInk } from './drawn';
import { fontFamilyFor } from './font';
import { Glass } from './glass';
import { haptic } from './haptics';
import { Icon, bottomInset, hasIcon } from './icon';
import { native } from './native';
import { frameOf, useOverlay, type Frame } from './overlay';
import { Text } from './text';
import type { MenuItem, MenuProps } from './types';

// iOS 27's menu, where iOS's own isn't there. Measured on the iPhone simulator: the button melts
// into a drop of glass that swells, rounder than it ends, into the menu, which covers the button
// it came from, a little larger all round, and grows toward whichever side of the screen has more
// room. Its items come into focus as it settles. It opens as the finger comes down, so a finger
// can slide straight on to an item and lift there to choose it; a capsule follows the finger
// over the items. Letting go of the menu, or touching off it, folds it back into the button.

/** An item's height, and the room above the first and below the last. */
const ROW = 42;
const PAD = 10;
const MIN_WIDTH = 250;
const RADIUS = 34;
/** How far the menu reaches past the button it covers, across and up or down. */
const OUTSET_X = 3.7;
const OUTSET_Y = 5.3;
/** The least room left between the menu and the edges of the screen. */
const MARGIN = 8;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Whether the glass grows out of the button itself. The package's native glass does that on its
 * own, a frame at a time on the UI thread; elsewhere the menu fades and grows in.
 */
const MORPHS = !!native && Platform.OS === 'android';

/** What the button's finger does to an open menu. */
interface Finger {
  /** The finger is here, on the screen: the item under it lights. */
  move(x: number, y: number): void;
  /** The finger lifted here: the item under it is chosen. */
  lift(x: number, y: number): void;
}

interface PanelProps {
  items: MenuItem[];
  /** The button, on the screen. */
  from: Frame;
  /** The layer the menu is drawn on, on the screen. */
  layer: Frame;
  closing: boolean;
  fontFamily?: string;
  finger: MutableRefObject<Finger | null>;
  onPick(value: string): void;
  onDismiss(): void;
  /** It's showing, and the button it covers can go. */
  onShown(): void;
  /** It has folded back into the button. */
  onClosed(): void;
}

function Panel({
  items,
  from,
  layer,
  closing,
  fontFamily,
  finger,
  onPick,
  onDismiss,
  onShown,
  onClosed,
}: PanelProps) {
  const ink = useInk();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [lit, setLit] = useState(-1);
  const latest = useRef({ onShown, onClosed });
  latest.current = { onShown, onClosed };
  // Without the native glass: a fade and a little growth, from the button's corner.
  const fade = useRef(new Animated.Value(0)).current;

  // The button goes at once, so the picture the glass takes of the screen doesn't hold it.
  useEffect(() => {
    latest.current.onShown();
  }, [closing]);

  useEffect(() => {
    if (!size || MORPHS) return;
    if (closing) {
      Animated.timing(fade, {
        toValue: 0,
        duration: 140,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => latest.current.onClosed());
    } else {
      Animated.spring(fade, {
        toValue: 1,
        stiffness: 320,
        damping: 27,
        mass: 1,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [size, closing, fade]);

  // Android's back button closes a menu, as a touch off it does.
  useEffect(() => {
    if (closing || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [closing, onDismiss]);

  const checks = items.some((item) => item.checked != null);
  const icons = items.some((item) => hasGlyph(item.icon));
  const family = fontFamilyFor(fontFamily);

  // Where it opens to, in the layer's points.
  const width = size ? clamp(size.width, MIN_WIDTH, layer.width - MARGIN * 2) : MIN_WIDTH;
  const height = PAD * 2 + ROW * items.length;
  const button = {
    x: from.x - layer.x,
    y: from.y - layer.y,
    width: from.width,
    height: from.height,
  };
  const up = from.y + from.height / 2 > layer.y + layer.height / 2;
  const leading = from.x + from.width / 2 <= layer.x + layer.width / 2;
  const top = Math.max(0, (StatusBar.currentHeight ?? 0) - layer.y) + MARGIN;
  const bottom = layer.height - MARGIN - Math.max(0, bottomInset());
  const to = {
    x: clamp(
      leading ? button.x - OUTSET_X : button.x + button.width + OUTSET_X - width,
      MARGIN,
      layer.width - MARGIN - width
    ),
    y: clamp(
      up ? button.y + button.height + OUTSET_Y - height : button.y - OUTSET_Y,
      top,
      Math.max(top, bottom - height)
    ),
  };

  const indexAt = (x: number, y: number) => {
    const across = x - layer.x - to.x;
    const down = y - layer.y - to.y - PAD;
    if (across < 0 || across > width || down < 0 || down >= ROW * items.length) return -1;
    const index = Math.floor(down / ROW);
    return items[index]?.disabled ? -1 : index;
  };
  const litRef = useRef(-1);
  const light = (index: number, scrubbing: boolean) => {
    // A tick as the finger slides on to another item, as iOS gives.
    if (scrubbing && index >= 0 && index !== litRef.current) haptic('select');
    if (index === litRef.current) return;
    litRef.current = index;
    setLit(index);
  };
  const lift = (x: number, y: number) => {
    const index = indexAt(x, y);
    light(-1, false);
    if (index >= 0) onPick(items[index]!.value);
  };
  useEffect(() => {
    finger.current = closing ? null : { move: (x, y) => light(indexAt(x, y), true), lift };
  });

  const colour = (item: MenuItem) =>
    item.disabled ? ink.disabled : item.destructive ? ink.red : ink.text;
  const rows = items.map((item, i) => (
    <View key={item.value} style={styles.row}>
      {lit === i && <View style={[styles.lit, { backgroundColor: ink.highlight }]} />}
      {checks && (
        <View style={styles.check}>
          {item.checked &&
            (hasIcon('checkmark') ? (
              <Icon name="checkmark" color={colour(item)} size={15} weight={1.4} />
            ) : (
              <Text style={{ color: colour(item), fontSize: 15, fontWeight: '600' }}>✓</Text>
            ))}
        </View>
      )}
      {icons && (
        <View style={[styles.icon, { marginLeft: checks ? 0 : 12 }]}>
          <Glyph icon={item.icon} color={colour(item)} size={22} weight={0.8} />
        </View>
      )}
      <Text
        numberOfLines={1}
        style={{
          marginLeft: icons ? 14 : checks ? 16 : 20,
          marginRight: 20,
          fontSize: 17,
          color: colour(item),
          fontFamily: family,
        }}>
        {item.label}
      </Text>
    </View>
  ));

  const touch = (event: GestureResponderEvent) =>
    light(indexAt(event.nativeEvent.pageX, event.nativeEvent.pageY), false);
  const scrub = (event: GestureResponderEvent) =>
    light(indexAt(event.nativeEvent.pageX, event.nativeEvent.pageY), true);
  // Grown from the corner of the button it opens from.
  const origin = `${leading ? 0 : 100}% ${up ? 100 : 0}%`;

  return (
    <>
      {/* A touch anywhere off the menu closes it, and goes no further. */}
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => true}
        onResponderGrant={() => {
          if (!closing) onDismiss();
        }}
      />
      {/* Measured once, unseen, for how wide the items need it to be. */}
      {!size && (
        <View
          pointerEvents="none"
          style={styles.measure}
          onLayout={(event: LayoutChangeEvent) => setSize(event.nativeEvent.layout)}>
          {rows}
        </View>
      )}
      {size && (
        <Animated.View
          accessibilityRole="menu"
          style={[
            { position: 'absolute', left: to.x, top: to.y, width, height },
            !MORPHS && {
              opacity: fade,
              transformOrigin: origin,
              transform: [
                { scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
            },
          ]}
          onStartShouldSetResponder={() => !closing}
          onResponderTerminationRequest={() => false}
          onResponderGrant={touch}
          onResponderMove={scrub}
          onResponderRelease={(event) => lift(event.nativeEvent.pageX, event.nativeEvent.pageY)}
          onResponderTerminate={() => light(-1, false)}>
          <Glass
            outermost
            still
            growFrom={[button.x - to.x, button.y - to.y, button.width, button.height]}
            open={!closing}
            onFolded={() => latest.current.onClosed()}
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { borderRadius: RADIUS, paddingVertical: PAD }]}>
            {rows}
          </Glass>
        </Animated.View>
      )}
    </>
  );
}

let made = 0;

/** A button that opens a menu. iOS shows its own menu instead. */
export function Menu({ items, onSelect, style, disabled, ...props }: MenuProps) {
  const overlay = useOverlay();
  const key = useRef(`liquidglass-menu-${made++}`).current;
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const [state, setState] = useState<{ from: Frame; layer: Frame; closing: boolean } | null>(null);
  const showing = useRef(false);
  const from = useRef<Frame | null>(null);
  const finger = useRef<Finger | null>(null);
  const moved = useRef(false);
  // The button hides while the menu that came out of it is open.
  const face = useRef(new Animated.Value(1)).current;

  const open = async () => {
    if (disabled) return;
    if (showing.current) {
      setState((now) => (now?.closing ? { ...now, closing: false } : now));
      return;
    }
    showing.current = true;
    const window = Dimensions.get('window');
    const [button, layer] = await Promise.all([
      frameOf(ref.current),
      overlay
        ? overlay.measure()
        : Promise.resolve({ x: 0, y: 0, width: window.width, height: window.height }),
    ]);
    if (!button || !layer) {
      showing.current = false;
      return;
    }
    from.current = button;
    setState({ from: button, layer, closing: false });
  };
  const close = () => setState((now) => (now && !now.closing ? { ...now, closing: true } : now));
  const closed = () => {
    showing.current = false;
    finger.current = null;
    face.setValue(1);
    setState(null);
  };
  const pick = (value: string) => {
    close();
    onSelect?.(value);
  };

  const panel = state && (
    <Panel
      items={items}
      from={state.from}
      layer={state.layer}
      closing={state.closing}
      fontFamily={props.fontFamily}
      finger={finger}
      onPick={pick}
      onDismiss={close}
      onShown={() => {
        // The button goes as the menu comes out of it, and comes back as the menu folds into it.
        if (state.closing)
          Animated.timing(face, {
            toValue: 1,
            duration: 120,
            delay: MORPHS ? 140 : 60,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        else {
          face.stopAnimation();
          face.setValue(0);
        }
      }}
      onClosed={closed}
    />
  );

  useEffect(() => {
    if (!overlay) return;
    if (panel) overlay.show(key, panel);
    else overlay.hide(key);
  });
  useEffect(() => () => overlay?.hide(key), [overlay, key]);

  // Where the finger is, on the screen, from where it is on the button.
  const onScreen = (x: number, y: number) => ({
    x: (from.current?.x ?? 0) + x,
    y: (from.current?.y ?? 0) + y,
  });
  const follow = (x: number, y: number, dx: number, dy: number) => {
    if (Math.hypot(dx, dy) > 4) moved.current = true;
    const at = onScreen(x, y);
    if (moved.current) finger.current?.move(at.x, at.y);
  };
  const end = (x: number, y: number, cancelled: boolean) => {
    if (cancelled) return;
    // A tap quicker than the page lets the button have the finger.
    if (!showing.current) {
      void open();
      return;
    }
    const at = onScreen(x, y);
    if (moved.current) finger.current?.lift(at.x, at.y);
  };

  type TrackEvent = {
    nativeEvent: { x: number; y: number; dx?: number; dy?: number; cancelled?: boolean };
  };
  const Track = NativeTrack;
  const catcher = Track ? (
    <Track
      patient
      enabled={!disabled}
      style={StyleSheet.absoluteFill}
      onTrackStart={() => {
        moved.current = false;
      }}
      onTrackClaim={() => void open()}
      onTrack={(event: TrackEvent) =>
        follow(
          event.nativeEvent.x,
          event.nativeEvent.y,
          event.nativeEvent.dx ?? 0,
          event.nativeEvent.dy ?? 0
        )
      }
      onTrackEnd={(event: TrackEvent) =>
        end(event.nativeEvent.x, event.nativeEvent.y, !!event.nativeEvent.cancelled)
      }
    />
  ) : null;
  // Without the native code, JavaScript follows the finger, from the moment it's down.
  const start = useRef({ x: 0, y: 0 });
  const responder = Track
    ? {}
    : {
        onStartShouldSetResponderCapture: () => !disabled,
        onResponderTerminationRequest: () => false,
        onResponderGrant: (event: GestureResponderEvent) => {
          moved.current = false;
          start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
          void open();
        },
        onResponderMove: (event: GestureResponderEvent) => {
          const { pageX, pageY } = event.nativeEvent;
          if (Math.hypot(pageX - start.current.x, pageY - start.current.y) > 4)
            moved.current = true;
          if (moved.current) finger.current?.move(pageX, pageY);
        },
        onResponderRelease: (event: GestureResponderEvent) => {
          if (moved.current) finger.current?.lift(event.nativeEvent.pageX, event.nativeEvent.pageY);
        },
      };

  return (
    <View style={[{ flexDirection: 'row' }, style]}>
      <View ref={ref} collapsable={false} style={{ flexGrow: fills(style) ? 1 : 0 }} {...responder}>
        <Animated.View style={{ opacity: face }}>
          <Button {...props} disabled={disabled} onPress={() => void open()} />
        </Animated.View>
        {catcher}
        {/* With nowhere over the page to open on, it opens in a window of its own. */}
        {!overlay && panel && (
          <Modal
            transparent
            visible
            animationType="none"
            statusBarTranslucent
            onRequestClose={close}>
            {panel}
          </Modal>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW, flexDirection: 'row', alignItems: 'center' },
  /** The capsule under the item a finger is on. */
  lit: { position: 'absolute', left: 6, right: 6, top: 1, bottom: 1, borderRadius: (ROW - 2) / 2 },
  check: { width: 24, marginLeft: 16, alignItems: 'center' },
  icon: { width: 30, alignItems: 'center' },
  measure: { position: 'absolute', left: 0, top: 0, opacity: 0 },
});
