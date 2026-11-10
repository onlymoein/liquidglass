import { useInsertionEffect } from "react";

import access from "../styles/access.css?inline";
import base from "../styles/base.css?inline";
import { ORDER } from "../styles/order";
import popup from "../styles/popup.css?inline";

/** A part of the stylesheet: its name, and its CSS. */
export type Part = readonly [name: string, css: string];

const ATTRIBUTE = "data-liquidglass";
const inserted = new Set<string>();

/**
 * Adds a part of the stylesheet to the document once. The parts go first in <head>, so the app's
 * own CSS comes after them and wins ties, as it would if imported after, and among themselves
 * they keep the stylesheet's order, whichever is added first.
 */
function insert([name, css]: Part): void {
  if (inserted.has(name) || typeof document === "undefined") return;
  inserted.add(name);
  if (document.head.querySelector(`style[${ATTRIBUTE}="${name}"]`)) return;
  const style = document.createElement("style");
  style.setAttribute(ATTRIBUTE, name);
  style.textContent = css;
  const rank = ORDER.indexOf(name);
  const ours = [...document.head.querySelectorAll<HTMLStyleElement>(`style[${ATTRIBUTE}]`)];
  const after = ours.find((other) => ORDER.indexOf(other.getAttribute(ATTRIBUTE)!) > rank);
  if (after) after.before(style);
  else if (ours.length) ours[ours.length - 1]!.after(style);
  else document.head.prepend(style);
}

// Every component stands on these: the glass itself, the shared popup motion, and what
// accessibility settings override, which comes last.
const CORE: readonly Part[] = [
  ["base", base],
  ["popup", popup],
  ["access", access],
];

/**
 * Brings a component's styles in before it's first drawn, and only that component's: a page
 * that uses one button gets the button's rules and not the menu's or the sheet's.
 */
export function useStyles(...parts: Part[]): void {
  useInsertionEffect(() => {
    for (const part of CORE) insert(part);
    for (const part of parts) insert(part);
  }, []);
}
