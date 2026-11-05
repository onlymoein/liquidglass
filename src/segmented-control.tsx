import {
  forwardRef,
  useEffect,
  useRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefAttributes,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { createSpring, type Spring } from "./internal/spring";

export interface SegmentedItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  items: SegmentedItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

/** A row of mutually exclusive choices, with a thumb that slides to the chosen one. */
export const SegmentedControl: ForwardRefExoticComponent<SegmentedControlProps & RefAttributes<HTMLDivElement>> =
  /* @__PURE__ */ forwardRef<HTMLDivElement, SegmentedControlProps>(function SegmentedControl(
    { items, value: valueProp, defaultValue, onValueChange, className, style, ...props },
    ref,
  ) {
    const [value, setValue] = useControllable<string | undefined, string>(valueProp, defaultValue ?? items[0]?.value, onValueChange);
    const thumbRef = useRef<HTMLSpanElement>(null);
    const spring = useRef<Spring | null>(null);
    const index = Math.max(0, items.findIndex((item) => item.value === value));

    useEffect(() => {
      const thumb = thumbRef.current!;
      const motion = createSpring(index, 443, 34, (next) => {
        thumb.style.transform = `translateX(${next * 100}%)`;
      });
      motion.paint();
      spring.current = motion;
      return () => motion.stop();
      // The spring starts where the control does, then follows `index` below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      spring.current?.set(index);
    }, [index]);

    const move = (event: KeyboardEvent<HTMLDivElement>) => {
      const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const open = items.filter((item) => !item.disabled);
      const at = open.findIndex((item) => item.value === value);
      const next = open[(at + step + open.length) % open.length];
      if (!next) return;
      setValue(next.value);
      event.currentTarget.querySelector<HTMLElement>(`[data-index="${items.indexOf(next)}"]`)?.focus();
    };

    return (
      <div
        ref={ref}
        role="radiogroup"
        className={cx("lg-segmented", className)}
        style={{ ...style, "--lg-segments": items.length } as CSSProperties}
        onKeyDown={move}
        {...props}
      >
        <span ref={thumbRef} className="lg-segmented-thumb" aria-hidden />
        {items.map((item, i) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            className="lg-segment"
            aria-checked={i === index}
            tabIndex={i === index ? 0 : -1}
            disabled={item.disabled}
            data-index={i}
            onClick={() => setValue(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  });
