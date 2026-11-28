import { expect } from "vitest";

/** One rule's declarations, by its exact selector, from a part of the stylesheet already on the page. */
export const rule = (part: string, selector: string): string => {
  const css = document.querySelector(`style[data-liquidglass="${part}"]`)?.textContent ?? "";
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  expect(match, `${part}: ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
};
