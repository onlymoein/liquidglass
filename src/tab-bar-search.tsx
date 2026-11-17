import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type JSX } from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { useStyles } from "./internal/styles";
import { SearchField } from "./search-field";
import { TabBar, type TabBarItem } from "./tab-bar";
import tabBarSearchCss from "./styles/tab-bar-search.css?inline";

export interface TabBarSearchProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange" | "onSubmit"> {
  /** The tabs, as for `TabBar`. Give them icons: the bar shrinks to the current tab's icon while searching. */
  items: TabBarItem[];
  /** The selected tab's `value`, or `null` for none. It stays selected while searching. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  /** The component used for tabs with an `href`, such as Next.js's `Link`. */
  link?: ElementType;
  /** Shrinks the tabs to the current tab's icon, as iOS does when a page scrolls down. The circle stays. */
  minimized?: boolean;
  /** Called when the shrunken tabs' icon is tapped, to ask for them back. */
  onExpand?: () => void;
  /** Whether the search field is open. */
  searching?: boolean;
  defaultSearching?: boolean;
  onSearchingChange?: (searching: boolean) => void;
  /** What's typed in the field. Closing the search empties it. */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  /** Called with the text when Enter is pressed in the field. */
  onSearch?: (query: string) => void;
  /** The search circle's accessible name. */
  searchLabel?: string;
  /** Shown in the empty field. */
  placeholder?: string;
  /** The tab bar's accessible name. */
  tabsLabel?: string;
}

/**
 * The iOS tab bar with a search tab: a glass circle beside the tabs. Tapping it grows the circle
 * into a search field and shrinks the tabs to the current tab's icon, which brings them back.
 */
export function TabBarSearch({
  items,
  value,
  defaultValue = null,
  onValueChange,
  link,
  minimized = false,
  onExpand,
  searching: searchingProp,
  defaultSearching = false,
  onSearchingChange,
  query: queryProp,
  defaultQuery = "",
  onQueryChange,
  onSearch,
  searchLabel = "Search",
  placeholder = "Search",
  tabsLabel = "Tabs",
  className,
  style,
  ...props
}: TabBarSearchProps): JSX.Element {
  useStyles(["tab-bar-search", tabBarSearchCss]);
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [searching, setSearching] = useControllable(searchingProp, defaultSearching, onSearchingChange);
  const [query, setQuery] = useControllable(queryProp, defaultQuery, onQueryChange);
  // The width the tabs have at rest, so that they can shrink to the icon and grow back.
  const [width, setWidth] = useState<number>();
  const was = useRef(searching);

  useLayoutEffect(() => {
    const bar = tabs.current?.firstElementChild as HTMLElement | null | undefined;
    if (!bar) return;
    const measure = () => {
      if (bar.offsetWidth) setWidth(bar.offsetWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [items.length]);

  // Typing starts as the field opens, and the circle takes the focus back as it closes.
  useEffect(() => {
    if (searching && !was.current) field.current?.focus({ preventScroll: true });
    else if (!searching && was.current && root.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
    was.current = searching;
  }, [searching]);

  const close = () => {
    setSearching(false);
    if (query) setQuery("");
  };

  return (
    <div
      ref={root}
      role="group"
      className={cx("lg-tab-search", className)}
      data-searching={searching ? "" : undefined}
      data-minimized={minimized && !searching ? "" : undefined}
      style={{ ...style, "--lg-tabs-width": width === undefined ? undefined : `${width}px` } as CSSProperties}
      {...props}
    >
      <div ref={tabs} className="lg-tab-search-tabs">
        <TabBar aria-label={tabsLabel} items={items} value={value} defaultValue={defaultValue} onValueChange={onValueChange} link={link} minimized={searching || minimized} onExpand={searching ? close : onExpand} />
      </div>
      <div className="lg-tab-search-slot">
        <SearchField
          ref={field}
          className="lg-tab-search-field"
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onValueChange={setQuery}
          // Closed, the field is only the circle's glass and glyph, and the circle is what's pressed.
          readOnly={!searching}
          tabIndex={searching ? undefined : -1}
          aria-hidden={searching ? undefined : true}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "Enter") onSearch?.(query);
          }}
        />
        <button
          ref={trigger}
          type="button"
          className="lg-tab-search-trigger"
          aria-label={searchLabel}
          aria-expanded={searching}
          tabIndex={searching ? -1 : undefined}
          aria-hidden={searching ? true : undefined}
          onClick={() => setSearching(true)}
        />
      </div>
    </div>
  );
}
