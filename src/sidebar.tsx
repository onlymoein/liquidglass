import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ElementType,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefAttributes,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { safeHref } from "./internal/href";
import { useRefraction } from "./internal/refraction";
import { useStyles } from "./internal/styles";
import sidebarCss from "./styles/sidebar.css?inline";

export interface SidebarItem {
  value: string;
  label: ReactNode;
  /** Drawn before the label, in the accent colour, as in an iPad sidebar. */
  icon?: ReactNode;
  /** Text after the label in secondary ink, such as an unread count. */
  badge?: ReactNode;
  /** Renders the row as a link. Clicking it navigates; the sidebar still tracks selection. */
  href?: string;
  disabled?: boolean;
}

/** A run of rows under a heading that can fold them away. */
export interface SidebarSection {
  /** The section's title, in small secondary type. Leave it out for a plain run of rows. */
  heading?: ReactNode;
  items: SidebarItem[];
  /** Makes the heading a button that folds the section away, with a chevron beside it. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export type SidebarEntry = SidebarItem | SidebarSection;

export interface SidebarProps extends Omit<HTMLAttributes<HTMLElement>, "defaultValue" | "onChange"> {
  /** Rows, and sections of rows. Rows set out on their own are grouped into one section without a heading. */
  items: SidebarEntry[];
  /** The selected row's `value`, or `null` for none. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  /** Slides the sidebar away when false, as iOS does when its toggle is tapped. Yours to switch from a button. */
  open?: boolean;
  /** Above the rows, such as a title and the button that hides the sidebar. */
  header?: ReactNode;
  /** Below the rows, such as an account or a settings button. */
  footer?: ReactNode;
  /** The component used for rows with an `href`, such as Next.js's `Link`. */
  link?: ElementType;
}

interface Group {
  key: string;
  section: SidebarSection;
}

const isSection = (entry: SidebarEntry): entry is SidebarSection => "items" in entry;

/** Rows set out on their own share one section; each section stands as it was given. */
function group(entries: SidebarEntry[]): Group[] {
  const groups: Group[] = [];
  entries.forEach((entry, index) => {
    if (isSection(entry)) {
      groups.push({ key: `section-${index}`, section: entry });
      return;
    }
    const last = groups[groups.length - 1];
    if (last && last.key.startsWith("rows-")) last.section.items.push(entry);
    else groups.push({ key: `rows-${index}`, section: { items: [entry] } });
  });
  return groups;
}

// What the arrow keys visit: rows, and the headings that fold. One class, so they come in page order.
const stops = ".lg-sidebar-stop:not(:disabled)";
const moves: Record<string, (index: number, count: number) => number> = {
  ArrowUp: (index, count) => (index - 1 + count) % count,
  ArrowDown: (index, count) => (index + 1) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * The panel of destinations beside an iPad or Mac app's content: a slab of glass floating over
 * it, with rows that fill as they're chosen and sections that fold away.
 */
export const Sidebar: ForwardRefExoticComponent<SidebarProps & RefAttributes<HTMLElement>> = /* @__PURE__ */ forwardRef<
  HTMLElement,
  SidebarProps
>(function Sidebar(
  { items, value: valueProp, defaultValue = null, onValueChange, open = true, header, footer, link: Link = "a", className, onKeyDown, ...props },
  forwardedRef,
) {
  useStyles(["sidebar", sidebarCss]);
  const ref = useRef<HTMLElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current!);
  useRefraction(ref);
  const id = useId();
  const [value, setValue] = useControllable<string | null, string>(valueProp, defaultValue, onValueChange);
  const groups = group(items);
  const [folded, setFolded] = useState(
    () => new Set(groups.filter(({ section }) => section.defaultCollapsed).map(({ key }) => key)),
  );

  // A sidebar that's slid away can't be reached from the keyboard or by assistive technology.
  useEffect(() => {
    ref.current?.toggleAttribute("inert", !open);
  }, [open]);

  const toggle = (key: string) =>
    setFolded((before) => {
      const after = new Set(before);
      if (!after.delete(key)) after.add(key);
      return after;
    });

  const click = (item: SidebarItem, event: MouseEvent) => {
    // A modified click on a link opens a tab and leaves this page as it is.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setValue(item.value);
  };

  // The arrow keys move between the rows and the headings that fold; Tab leaves as usual.
  const move = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    const step = moves[event.key];
    const target = event.target as HTMLElement;
    if (event.defaultPrevented || !step || target.matches("input, textarea, select, [contenteditable]")) return;
    const all = [...event.currentTarget.querySelectorAll<HTMLElement>(stops)].filter((stop) => !stop.closest("[data-folded] > .lg-sidebar-fold"));
    const index = all.indexOf(target);
    if (index < 0) return;
    event.preventDefault();
    all[step(index, all.length)]?.focus();
  };

  return (
    <nav
      ref={ref}
      className={cx("lg-glass lg-sidebar", className)}
      data-open={open ? undefined : "false"}
      onKeyDown={move}
      {...props}
    >
      {header == null ? null : <div className="lg-sidebar-header">{header}</div>}
      <div className="lg-sidebar-scroll">
        {groups.map(({ key, section }) => {
          const heading = `${id}-${key}`;
          const collapsed = section.collapsible === true && folded.has(key);
          return (
            <div key={key} className="lg-sidebar-section" data-folded={collapsed ? "" : undefined}>
              {section.heading == null ? null : section.collapsible ? (
                <button
                  type="button"
                  id={heading}
                  className="lg-sidebar-heading lg-sidebar-stop"
                  aria-expanded={!collapsed}
                  aria-controls={`${heading}-rows`}
                  onClick={() => toggle(key)}
                >
                  {section.heading}
                  <svg className="lg-sidebar-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 4.5 6 7.5 9 4.5" />
                  </svg>
                </button>
              ) : (
                <div id={heading} className="lg-sidebar-heading" data-static="">
                  {section.heading}
                </div>
              )}
              <div className="lg-sidebar-fold" id={`${heading}-rows`}>
                <ul className="lg-sidebar-rows" aria-labelledby={section.heading == null ? undefined : heading}>
                  {section.items.map((item) => {
                    const selected = item.value === value;
                    const href = item.disabled ? undefined : safeHref(item.href);
                    const content = (
                      <>
                        {item.icon == null ? null : <span className="lg-sidebar-icon">{item.icon}</span>}
                        <span className="lg-sidebar-label">{item.label}</span>
                        {item.badge == null ? null : <span className="lg-sidebar-badge">{item.badge}</span>}
                      </>
                    );
                    return (
                      <li key={item.value}>
                        {href !== undefined ? (
                          <Link
                            href={href}
                            className="lg-sidebar-item lg-sidebar-stop"
                            data-selected={selected ? "" : undefined}
                            aria-current={selected ? "page" : undefined}
                            draggable={false}
                            onClick={(event: MouseEvent) => click(item, event)}
                          >
                            {content}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="lg-sidebar-item lg-sidebar-stop"
                            data-selected={selected ? "" : undefined}
                            aria-current={selected ? "page" : undefined}
                            disabled={item.disabled}
                            onClick={(event) => click(item, event)}
                          >
                            {content}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
      {footer == null ? null : <div className="lg-sidebar-footer">{footer}</div>}
    </nav>
  );
});
