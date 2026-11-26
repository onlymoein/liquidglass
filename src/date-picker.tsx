import { useEffect, useId, useLayoutEffect, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  addMonths,
  clampDay,
  dayOf,
  firstDayOf,
  monthOf,
  outside,
  placeCalendar,
  sameDay,
  sameDayIn,
  weeksOf,
  type Month,
} from "./internal/calendar";
import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { reducedMotion, useModal } from "./internal/modal";
import { fitLens, rimAt } from "./internal/refraction";
import { afterGlassShows, createSpring } from "./internal/spring";
import { useStyles } from "./internal/styles";
import layerCss from "./styles/layer.css?inline";
import datePickerCss from "./styles/date-picker.css?inline";

export interface DatePickerProps {
  /** The date picked. Its time of day is kept when another day is picked. */
  value?: Date;
  /** The date picked at first, when `value` isn't given. Today, if neither is. */
  defaultValue?: Date;
  onValueChange?: (date: Date) => void;
  /** Whether the calendar is open. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The first day that can be picked. Days before it are greyed out. */
  min?: Date;
  /** The last day that can be picked. Days after it are greyed out. */
  max?: Date;
  /** The language and region for the month, the weekdays and the date on the button. The browser's, if not given. */
  locale?: string;
  /** The day weeks start on, from 0 for Sunday. The locale's, if not given. */
  firstDayOfWeek?: number;
  disabled?: boolean;
  /** Sends the date in a form, as YYYY-MM-DD. */
  name?: string;
  className?: string;
  /** What the date is for, read out with it. */
  "aria-label"?: string;
}

// The calendar of iOS 27's compact date picker, measured on an iPhone 17 simulator running iOS 27.2.
const RADIUS = 27;
// Its shape grows out of the button with a small overshoot and runs back into it at once.
const OPENING = [416, 31.3] as const;
const CLOSING = [900, 60] as const;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const chevron = (path: string, width: number, height: number, className: string) => (
  <svg className={className} viewBox={`0 0 ${width} ${height}`} width={width} height={height} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={path} />
  </svg>
);

/**
 * A date on a button that opens a calendar on glass, as iOS 27's compact date picker does.
 * Picking a day keeps the calendar open; tapping anywhere else, or Escape, closes it.
 */
export function DatePicker({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  min,
  max,
  locale,
  firstDayOfWeek,
  disabled,
  name,
  className,
  "aria-label": label,
}: DatePickerProps): JSX.Element {
  useStyles(["layer", layerCss], ["date-picker", datePickerCss]);
  const [value, setValue] = useControllable(valueProp, defaultValue ?? new Date(), onValueChange);
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { phase, finished } = useModal(dialogRef, open, () => setOpen(false));
  const done = useRef(finished);
  useEffect(() => {
    done.current = finished;
  });

  // The month shown, and the day the arrow keys move from. Each time the calendar opens they
  // go back to the date picked.
  const [shown, setShown] = useState<Month>(() => monthOf(value));
  const [focused, setFocused] = useState<Date>(() => clampDay(value, min, max));
  const [opened, setOpened] = useState(open);
  if (open !== opened) {
    setOpened(open);
    if (open) {
      const start = clampDay(value, min, max);
      setShown(monthOf(start));
      setFocused(start);
    }
  }

  const today = new Date();
  const firstDay = firstDayOfWeek ?? firstDayOf(locale);
  const weeks = weeksOf(shown, firstDay);
  const days = weeks.flat().filter((day): day is Date => !!day);
  const enabled = days.filter((day) => !outside(day, min, max));
  // One day in the grid takes Tab: the one the arrows are on, or the picked one, or the first that can be picked.
  const tabbable =
    enabled.find((day) => sameDay(day, focused)) ?? enabled.find((day) => sameDay(day, value)) ?? enabled[0];
  const before = addMonths(shown, -1);
  const after = addMonths(shown, 1);
  const noEarlier = !!min && new Date(before.year, before.month + 1, 0) < dayOf(min);
  const noLater = !!max && new Date(after.year, after.month, 1) > dayOf(max);

  const format = (options: Intl.DateTimeFormatOptions, date: Date) => new Intl.DateTimeFormat(locale, options).format(date);
  const text = format({ dateStyle: "medium" }, value);
  const title = format({ month: "long", year: "numeric" }, new Date(shown.year, shown.month, 1));
  // 2023-01-01 was a Sunday.
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + ((firstDay + i) % 7)));

  const pick = (day: Date) => {
    setFocused(day);
    setValue(new Date(day.getFullYear(), day.getMonth(), day.getDate(), value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds()));
  };

  const turn = (by: number) => {
    const month = addMonths(shown, by);
    setShown(month);
    setFocused(clampDay(sameDayIn(focused, month), min, max));
  };

  // Opened from the keyboard, the picked day takes focus. Opened by a tap, the calendar takes it
  // itself, so no day comes up ringed, and the first arrow key goes into the days.
  const keyed = useRef(false);
  const tabbableDay = () => gridRef.current?.querySelector<HTMLElement>('button[tabindex="0"]');

  // After the arrow keys move, the day they reach takes focus once it's drawn.
  const moved = useRef(false);
  const key = (event: ReactKeyboardEvent<HTMLElement>) => {
    const from = tabbable;
    const inGrid = event.target instanceof Node && !!gridRef.current?.contains(event.target);
    if (!from || (!inGrid && event.target !== event.currentTarget)) return;
    const ahead = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
    const column = (from.getDay() - firstDay + 7) % 7;
    const page = event.shiftKey ? 12 : 1;
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(from, -ahead),
      ArrowRight: () => addDays(from, ahead),
      ArrowUp: () => addDays(from, -7),
      ArrowDown: () => addDays(from, 7),
      Home: () => addDays(from, -column),
      End: () => addDays(from, 6 - column),
      PageUp: () => sameDayIn(from, addMonths(monthOf(from), -page)),
      PageDown: () => sameDayIn(from, addMonths(monthOf(from), page)),
    };
    const next = moves[event.key]?.();
    if (!next) return;
    event.preventDefault();
    if (!inGrid) {
      tabbableDay()?.focus();
      return;
    }
    const day = clampDay(next, min, max);
    moved.current = true;
    setFocused(day);
    setShown(monthOf(day));
  };
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    tabbableDay()?.focus();
  });

  const phaseRef = useRef(phase);
  const turnRef = useRef<((target: 0 | 1) => void) | null>(null);

  // Laid out before the first frame, so the calendar never shows where it isn't yet placed.
  useLayoutEffect(() => {
    if (phase === "closed") return;
    const card = cardRef.current!;
    const surface = surfaceRef.current!;
    const content = contentRef.current!;
    const trigger = triggerRef.current!;
    let from = trigger.getBoundingClientRect();
    let to = { left: 0, top: 0, width: 0, height: 0 };
    let stopRim = () => {};
    let stopLens: (() => void) | undefined;
    let resting = false;

    // The calendar's shape at a point between the button (0) and where it rests (1), and past it.
    const paint = (progress: number) => {
      if (progress === 1 && phaseRef.current !== "leaving") {
        if (resting) return;
        resting = true;
        for (const name of ["left", "top", "width", "height", "borderRadius", "opacity"] as const) surface.style[name] = "";
        content.style.opacity = "";
        content.style.clipPath = "";
        delete card.dataset.morphing;
        stopLens = fitLens(surface);
        return;
      }
      if (resting) {
        resting = false;
        stopLens?.();
        stopLens = undefined;
      }
      card.dataset.morphing = "";
      const between = (a: number, b: number) => a + (b - a) * progress;
      const x = between(from.left - to.left, 0);
      const y = between(from.top - to.top, 0);
      const width = Math.max(0, between(from.width, to.width));
      const height = Math.max(0, between(from.height, to.height));
      const radius = Math.min(between(from.height / 2, RADIUS), width / 2, height / 2);
      surface.style.left = `${x}px`;
      surface.style.top = `${y}px`;
      surface.style.width = `${width}px`;
      surface.style.height = `${height}px`;
      surface.style.borderRadius = `${radius}px`;
      // Closing, the last of the glass melts into the button rather than sitting on it.
      surface.style.opacity = phaseRef.current === "leaving" ? String(clamp(progress / 0.1)) : "";
      // The days come up once the glass is part-way open, and go first as it closes.
      content.style.opacity = String(clamp((progress - 0.3) / 0.5));
      const inset = [y, to.width - x - width, to.height - y - height, x].map((n) => `${Math.max(0, n)}px`).join(" ");
      content.style.clipPath = `inset(${inset} round ${radius}px)`;
      if (progress === 0 && phaseRef.current === "leaving") done.current();
    };
    const spring = createSpring(0, ...OPENING, paint);

    // Placed by its button, and placed again if the window changes or the page moves.
    const place = () => {
      from = trigger.getBoundingClientRect();
      const size = { width: card.offsetWidth, height: card.offsetHeight };
      const rtl = getComputedStyle(trigger).direction === "rtl";
      const at = placeCalendar(from, size, { width: innerWidth, height: innerHeight }, rtl);
      card.style.left = `${at.left}px`;
      card.style.top = `${at.top}px`;
      if (size.width !== to.width || size.height !== to.height) {
        stopRim();
        stopRim = rimAt(surface, size.width, size.height, RADIUS);
        if (resting) {
          stopLens?.();
          stopLens = fitLens(surface);
        }
      }
      to = { left: at.left, top: at.top, ...size };
      if (!resting) spring.paint();
    };
    place();
    spring.paint();
    const stopWaiting = afterGlassShows(() => spring.set(1, reducedMotion()));
    if (keyed.current) tabbableDay()?.focus({ preventScroll: true });
    keyed.current = false;
    turnRef.current = (target) => {
      stopWaiting();
      const [stiffness, damping] = target ? OPENING : CLOSING;
      spring.tune(stiffness, damping);
      spring.set(target, reducedMotion());
    };

    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    return () => {
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
      stopWaiting();
      spring.stop();
      turnRef.current = null;
      stopRim();
      stopLens?.();
    };
  }, [phase === "closed"]); // eslint-disable-line react-hooks/exhaustive-deps

  // Closing runs the shape back into the button, and opening again part-way turns it round.
  useEffect(() => {
    const before = phaseRef.current;
    phaseRef.current = phase;
    if (phase === "leaving") turnRef.current?.(0);
    if (phase === "open" && before === "leaving") turnRef.current?.(1);
  }, [phase]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cx("lg-date-trigger", className)}
        aria-label={label ? `${label}, ${text}` : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open ? "" : undefined}
        disabled={disabled}
        onPointerDown={() => (keyed.current = false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") keyed.current = true;
        }}
        onClick={() => setOpen(!open)}
      >
        {text}
      </button>
      {name ? <input type="hidden" name={name} value={isoDay(value)} /> : null}
      <dialog
        ref={dialogRef}
        className="lg-modal lg-date"
        data-phase={phase}
        aria-label={label}
        aria-labelledby={label ? undefined : titleId}
        onKeyDown={key}
      >
        {phase === "closed" ? null : (
          <>
            <span className="lg-modal-scrim" aria-hidden onClick={() => setOpen(false)} />
            <div ref={cardRef} className="lg-date-card" data-morphing="">
              <div ref={surfaceRef} className="lg-glass lg-date-surface" />
              <div ref={contentRef} className="lg-date-content">
                <div className="lg-date-header">
                  <span id={titleId} className="lg-date-title" aria-live="polite">
                    {title}
                    {chevron("M1.25 1.25 6 6l-4.75 4.75", 7, 12, "lg-date-more")}
                  </span>
                  <button type="button" className="lg-date-turn" aria-label="Previous Month" disabled={noEarlier} onClick={() => turn(-1)}>
                    {chevron("M9 1.5 1.5 9 9 16.5", 11, 18, "lg-date-arrow")}
                  </button>
                  <button type="button" className="lg-date-turn" aria-label="Next Month" disabled={noLater} onClick={() => turn(1)}>
                    {chevron("M2 1.5 9.5 9 2 16.5", 11, 18, "lg-date-arrow")}
                  </button>
                </div>
                <div ref={gridRef} role="grid" className="lg-date-grid" aria-labelledby={titleId}>
                  <div role="row" className="lg-date-weekdays">
                    {weekdays.map((day) => (
                      <span key={day.getDay()} role="columnheader" aria-label={format({ weekday: "long" }, day)}>
                        {format({ weekday: "short" }, day)}
                      </span>
                    ))}
                  </div>
                  <div className="lg-date-weeks" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
                    {weeks.map((week, row) => (
                      <div key={row} role="row" className="lg-date-week">
                        {week.map((day, column) =>
                          day ? (
                            <span key={column} role="gridcell" aria-selected={sameDay(day, value)}>
                              <button
                                type="button"
                                className="lg-date-day"
                                tabIndex={sameDay(day, tabbable) ? 0 : -1}
                                disabled={outside(day, min, max)}
                                aria-label={format({ dateStyle: "full" }, day)}
                                aria-current={sameDay(day, today) ? "date" : undefined}
                                data-today={sameDay(day, today) ? "" : undefined}
                                data-selected={sameDay(day, value) ? "" : undefined}
                                onClick={() => pick(day)}
                              >
                                {day.getDate()}
                              </button>
                            </span>
                          ) : (
                            <span key={column} role="gridcell" />
                          ),
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
