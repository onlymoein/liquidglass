import {
  forwardRef,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type KeyboardEvent,
  type PointerEvent,
  type RefAttributes,
} from "react";

import { Button } from "./button";
import { Input } from "./input";
import { SegmentedControl } from "./segmented-control";
import { Sheet } from "./sheet";
import { Slider } from "./slider";
import { useControllable } from "./internal/controllable";
import {
  cssColor,
  formatColor,
  GRID_COLUMNS,
  gridColors,
  hsvToRgb,
  parseColor,
  rgbToHsv,
  spectrumAt,
  spectrumOf,
  type Hsva,
  type Rgba,
} from "./internal/color";
import { cx } from "./internal/cx";
import { useStyles } from "./internal/styles";
import colorWellCss from "./styles/color-well.css?inline";

export interface ColorWellProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "defaultValue" | "onChange" | "title"> {
  /** The colour, as `#rrggbb`, or `#rrggbbaa` when it's see-through. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Whether the picker offers an Opacity slider. Default true. */
  supportsAlpha?: boolean;
  /** The picker's heading. Default "Colors". */
  title?: string;
  /** Colours kept to hand under the picker, as hex. */
  swatches?: string[];
}

type Mode = "grid" | "spectrum" | "sliders";

const FALLBACK: Rgba = { r: 0, g: 136, b: 255, a: 1 };
const GRID = gridColors();
const RAINBOW = "linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))";
// A step of an arrow key across the spectrum, and with Shift held.
const STEP = 0.01;
const BIG_STEP = 0.1;

type EyeDropperWindow = Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };

const channels = [
  ["r", "Red"],
  ["g", "Green"],
  ["b", "Blue"],
] as const;

function Eyedropper() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3z" />
    </svg>
  );
}

function Close() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/**
 * The iOS colour well: a round swatch in a ring of colours that opens the colour picker, a
 * sheet with the grid, the spectrum, and sliders, and an opacity slider and an eyedropper.
 */
export const ColorWell: ForwardRefExoticComponent<ColorWellProps & RefAttributes<HTMLButtonElement>> = /* @__PURE__ */ forwardRef<
  HTMLButtonElement,
  ColorWellProps
>(function ColorWell(
  { value: valueProp, defaultValue = "#0088ff", onValueChange, supportsAlpha = true, title = "Colors", swatches, className, style, type = "button", onClick, "aria-label": label = "Color", ...props },
  ref,
) {
  useStyles(["color-well", colorWellCss]);
  const [value, setValue] = useControllable(valueProp, defaultValue, onValueChange);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("grid");
  const rgba = parseColor(value) ?? parseColor(defaultValue) ?? FALLBACK;
  const color = supportsAlpha ? rgba : { ...rgba, a: 1 };
  const current = formatColor(color, supportsAlpha);

  // The picker keeps the colour in hue, saturation and value, so that dragging through grey
  // or black doesn't forget which hue it was in. A colour that arrives from outside replaces it.
  const [hsv, setHsv] = useState<Hsva>(() => rgbToHsv(color));
  if (formatColor(hsvToRgb(hsv), supportsAlpha) !== current) setHsv(rgbToHsv(color));

  const commit = (next: Hsva) => {
    const kept = supportsAlpha ? next : { ...next, a: 1 };
    setHsv(kept);
    setValue(formatColor(hsvToRgb(kept), supportsAlpha));
  };
  const commitRgb = (next: Rgba) => {
    const found = rgbToHsv(next);
    // A grey or black has no hue of its own; it keeps the one it had.
    if (found.s === 0 || found.v === 0) found.h = hsv.h;
    if (found.v === 0) found.s = hsv.s;
    commit(found);
  };

  const [draft, setDraft] = useState<string | null>(null);
  const settleDraft = () => {
    const parsed = draft === null ? null : parseColor(draft.startsWith("#") ? draft : `#${draft}`);
    if (parsed) commitRgb(supportsAlpha ? parsed : { ...parsed, a: 1 });
    setDraft(null);
  };
  const invalid = draft !== null && !parseColor(draft.startsWith("#") ? draft : `#${draft}`);

  const dropper = typeof window === "undefined" ? undefined : (window as EyeDropperWindow).EyeDropper;
  const sample = async () => {
    try {
      const picked = parseColor((await new dropper!().open()).sRGBHex);
      if (picked) commitRgb({ ...picked, a: color.a });
    } catch {
      // Dismissed with Escape: nothing was chosen.
    }
  };

  const area = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const aim = (event: PointerEvent<HTMLElement>) => {
    const box = area.current!.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const { h, s, v } = spectrumAt((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
    commit({ h, s, v, a: hsv.a });
  };
  const spectrumKeys = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? BIG_STEP : STEP;
    const now = spectrumOf(hsv);
    const next = { ...now };
    if (event.key === "ArrowLeft") next.x = Math.max(0, now.x - step);
    else if (event.key === "ArrowRight") next.x = Math.min(1, now.x + step);
    else if (event.key === "ArrowUp") next.y = Math.max(0, now.y - step);
    else if (event.key === "ArrowDown") next.y = Math.min(1, now.y + step);
    else return;
    event.preventDefault();
    const { h, s, v } = spectrumAt(next.x, next.y);
    commit({ h, s, v, a: hsv.a });
  };
  const place = spectrumOf(hsv);

  const base = formatColor({ ...color, a: 1 }, false);
  const grid = useRef<HTMLDivElement>(null);
  const gridKeys = (event: KeyboardEvent<HTMLElement>) => {
    const cells = [...grid.current!.querySelectorAll<HTMLButtonElement>("button")];
    const at = cells.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -GRID_COLUMNS, ArrowDown: GRID_COLUMNS }[event.key];
    const target = event.key === "Home" ? 0 : event.key === "End" ? cells.length - 1 : move === undefined ? undefined : at + move;
    if (target === undefined || target < 0 || target >= cells.length) return;
    event.preventDefault();
    cells[target]!.focus();
  };
  const tabStop = GRID.includes(base) ? base : GRID[0];

  const set = (channel: "r" | "g" | "b", next: number) => commitRgb({ ...hsvToRgb(hsv), [channel]: next });
  const rgb = hsvToRgb(hsv);
  const solid: Rgba = { ...rgb, a: 1 };
  const clear: Rgba = { ...rgb, a: 0 };
  const rail = (from: Rgba, to: Rgba): CSSProperties =>
    ({ "--lg-rail-color": `linear-gradient(to right, ${cssColor(from)}, ${cssColor(to)})` }) as CSSProperties;

  return (
    <>
      <button
        ref={ref}
        type={type}
        className={cx("lg-color-well", className)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ ...style, "--lg-well-color": cssColor(color) } as CSSProperties}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setOpen(true);
        }}
        {...props}
      >
        <span className="lg-color-well-fill" aria-hidden />
      </button>
      <Sheet aria-label={title} open={open} onOpenChange={setOpen} detents={["large"]}>
        <div className="lg-color-picker" style={{ "--lg-well-color": cssColor(color), "--lg-well-solid": cssColor({ ...color, a: 1 }) } as CSSProperties}>
          <div className="lg-color-header">
            {dropper ? <Button size="small" icon={<Eyedropper />} aria-label="Pick a colour from the screen" onClick={sample} /> : <span className="lg-color-header-gap" />}
            <h3 className="lg-color-title">{title}</h3>
            <Button size="small" icon={<Close />} aria-label="Close" onClick={() => setOpen(false)} />
          </div>
          <SegmentedControl
            aria-label="Colour picker"
            value={mode}
            onValueChange={(next) => setMode(next as Mode)}
            items={[
              { value: "grid", label: "Grid" },
              { value: "spectrum", label: "Spectrum" },
              { value: "sliders", label: "Sliders" },
            ]}
          />
          {mode === "grid" && (
            <div ref={grid} className="lg-color-grid" role="group" aria-label="Grid" onKeyDown={gridKeys}>
              {GRID.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className="lg-color-cell"
                  aria-label={hex}
                  aria-pressed={hex === base}
                  tabIndex={hex === tabStop ? 0 : -1}
                  style={{ "--lg-cell": hex } as CSSProperties}
                  onClick={() => {
                    const picked = parseColor(hex)!;
                    commitRgb({ ...picked, a: color.a });
                  }}
                />
              ))}
            </div>
          )}
          {mode === "spectrum" && (
            <div
              ref={area}
              className="lg-color-spectrum"
              role="group"
              aria-label="Spectrum"
              tabIndex={0}
              data-lg-no-sheet-drag=""
              style={{ "--lg-rainbow": RAINBOW } as CSSProperties}
              onKeyDown={spectrumKeys}
              onPointerDown={(event) => {
                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                aim(event);
              }}
              onPointerMove={(event) => {
                if (dragging.current) aim(event);
              }}
              onPointerUp={(event) => {
                dragging.current = false;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                dragging.current = false;
              }}
            >
              <span className="lg-color-spectrum-thumb" style={{ left: `${place.x * 100}%`, top: `${place.y * 100}%` }} aria-hidden />
            </div>
          )}
          {mode === "sliders" && (
            <div className="lg-color-sliders">
              {channels.map(([channel, name]) => (
                <div key={channel} className="lg-color-row">
                  <span className="lg-color-label">{name[0]}</span>
                  <Slider
                    className="lg-color-slider"
                    aria-label={name}
                    min={0}
                    max={255}
                    value={rgb[channel]}
                    onValueChange={(next) => set(channel, next)}
                    style={rail({ ...rgb, [channel]: 0 }, { ...rgb, [channel]: 255 })}
                  />
                  <output className="lg-color-value">{rgb[channel]}</output>
                </div>
              ))}
              <Input
                className="lg-color-hex"
                aria-label="Hex"
                aria-invalid={invalid || undefined}
                variant="fill"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                maxLength={9}
                value={draft ?? current}
                onValueChange={setDraft}
                onBlur={settleDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") settleDraft();
                }}
              />
            </div>
          )}
          {supportsAlpha && (
            <div className="lg-color-row">
              <span className="lg-color-label">Opacity</span>
              <Slider
                className="lg-color-slider lg-color-opacity"
                aria-label="Opacity"
                min={0}
                max={100}
                value={Math.round(hsv.a * 100)}
                onValueChange={(next) => commit({ ...hsv, a: next / 100 })}
                style={rail(clear, solid)}
              />
              <output className="lg-color-value">{Math.round(hsv.a * 100)}%</output>
            </div>
          )}
          <div className="lg-color-preview" aria-live="polite">
            <span className="lg-color-preview-swatch" aria-hidden />
            <output className="lg-color-hex-readout">{current}</output>
          </div>
          {swatches && swatches.length > 0 && (
            <div className="lg-color-swatches" role="group" aria-label="Swatches">
              {swatches.flatMap((hex) => {
                const parsed = parseColor(hex);
                if (!parsed) return [];
                const text = formatColor(parsed, true);
                return [
                  <button
                    key={text}
                    type="button"
                    className="lg-color-cell lg-color-swatch"
                    aria-label={text}
                    aria-pressed={text === current}
                    style={{ "--lg-cell": cssColor(parsed) } as CSSProperties}
                    onClick={() => commitRgb(supportsAlpha ? parsed : { ...parsed, a: 1 })}
                  />,
                ];
              })}
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
});
