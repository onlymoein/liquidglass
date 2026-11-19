export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where a trigger stands, without the scale its press spring may still be writing on it. */
export function triggerRect(trigger: HTMLElement): Box {
  const rect = trigger.getBoundingClientRect();
  const width = trigger.offsetWidth;
  const height = trigger.offsetHeight;
  return {
    left: rect.left + rect.width / 2 - width / 2,
    top: rect.top + rect.height / 2 - height / 2,
    width: width,
    height: height,
  };
}

/** The size of the window the popup has to fit in. */
export function viewport(): { width: number; height: number } {
  return {
    width: document.documentElement.clientWidth || window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Puts a popup in the top layer, where it's above everything on the page and nothing that
 * scrolls or clips around its trigger can cut it off. The attribute goes on only where the
 * browser has popovers: elsewhere it can hide the popup.
 */
export function showInTopLayer(card: HTMLElement): void {
  if (!("showPopover" in card) || card.matches(":popover-open")) return;
  card.setAttribute("popover", "manual");
  try {
    card.showPopover();
  } catch {
    // Fixed positioning alone still places it.
  }
}

export function hideFromTopLayer(card: HTMLElement): void {
  if (!("hidePopover" in card) || !card.matches(":popover-open")) return;
  try {
    card.hidePopover();
  } catch {
    // Unmounting takes it out of the top layer anyway.
  }
}
