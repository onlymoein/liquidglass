import { EDGE, type Rect } from "./placement";

/** A month, by its year and its index from 0 for January. */
export interface Month {
  year: number;
  month: number;
}

export const monthOf = (date: Date): Month => ({ year: date.getFullYear(), month: date.getMonth() });

export const addMonths = ({ year, month }: Month, by: number): Month => {
  const index = year * 12 + month + by;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
};

export const sameDay = (a: Date | null | undefined, b: Date | null | undefined): boolean =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The day at midnight, local time. */
export const dayOf = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** The same day of a month, or its last day when the month is shorter. */
export function sameDayIn(date: Date, { year, month }: Month): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), last));
}

/** Whether a day is outside min and max, which count as whole days. */
export const outside = (day: Date, min: Date | undefined, max: Date | undefined): boolean =>
  (!!min && dayOf(day) < dayOf(min)) || (!!max && dayOf(day) > dayOf(max));

/** The nearest day to the one given that's inside min and max. */
export function clampDay(day: Date, min: Date | undefined, max: Date | undefined): Date {
  if (min && dayOf(day) < dayOf(min)) return dayOf(min);
  if (max && dayOf(day) > dayOf(max)) return dayOf(max);
  return dayOf(day);
}

/**
 * The weeks of a month as rows of seven, starting on the given day of the week (0 for
 * Sunday). As on iOS, the days of the months either side are left blank.
 */
export function weeksOf({ year, month }: Month, firstDay: number): (Date | null)[][] {
  const lead = (new Date(year, month, 1).getDay() - firstDay + 7) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const weeks: (Date | null)[][] = [];
  for (let cell = 0; cell < lead + days; cell += 7) {
    weeks.push(
      Array.from({ length: 7 }, (_, column) => {
        const day = cell + column - lead + 1;
        return day >= 1 && day <= days ? new Date(year, month, day) : null;
      }),
    );
  }
  return weeks;
}

/** The first day of the week where the locale is, or Sunday when the browser can't say. */
export function firstDayOf(locale: string | undefined): number {
  try {
    const info = new Intl.Locale(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay;
    return firstDay ? firstDay % 7 : 0;
  } catch {
    return 0;
  }
}

/** How far the calendar covers its trigger, measured on iOS 27. */
export const OVERLAP = 12;
/** How far the calendar sits from the side of a phone's screen, measured on iOS 27. */
export const INSET = 16;
/** Below this width the window is taken for a phone's, where iOS pins the calendar to the side. */
export const PHONE = 500;

/**
 * Where the calendar goes, given its trigger and its own size.
 *
 * On iOS 27 it covers 12 points of its trigger, on whichever side has more room, and on a phone
 * it's always 16 points from the leading side of the screen, wherever the trigger is. In a wider
 * window it lines up with the trigger's leading edge instead.
 */
export function placeCalendar(
  trigger: Rect,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
  rtl = false,
): { left: number; top: number; side: "bottom" | "top" } {
  const bottom = trigger.top + trigger.height;
  const below = viewport.height - bottom;
  const above = trigger.top;
  const side = below > above ? "bottom" : "top";
  const wanted = side === "bottom" ? bottom - OVERLAP : trigger.top + OVERLAP - card.height;
  const top = Math.max(EDGE, Math.min(wanted, viewport.height - EDGE - card.height));
  const inset = Math.min(INSET, Math.max(0, (viewport.width - card.width) / 2));
  const lined =
    viewport.width < PHONE
      ? rtl
        ? viewport.width - inset - card.width
        : inset
      : rtl
        ? trigger.left + trigger.width - card.width
        : trigger.left;
  const left = Math.max(inset, Math.min(lined, viewport.width - inset - card.width));
  return { left, top, side };
}
