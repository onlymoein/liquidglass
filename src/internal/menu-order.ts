export type EntryKind = "separator" | "heading" | "row";

/**
 * The order a menu lists its entries when it opens upward.
 *
 * iOS lists such a menu from the bottom, so the first row sits nearest the button that opened
 * it: the sections come in reverse, and so do the rows within each. A heading stays at the
 * head of its own section, and a divider stays between the same two sections.
 *
 * A section runs from a heading, or from the start or a divider, up to the next one.
 */
export function upwardOrder<T>(entries: readonly T[], kind: (entry: T) => EntryKind): T[] {
  // Each token is a divider on its own, or one section: its heading, if it has one, then its rows.
  const tokens: T[][] = [];
  let section: T[] | null = null;
  for (const entry of entries) {
    const as = kind(entry);
    if (as === "separator") {
      tokens.push([entry]);
      section = null;
      continue;
    }
    if (as === "heading" || !section) {
      section = [];
      tokens.push(section);
    }
    section.push(entry);
  }
  // A divider is a token of one, so reversing it changes nothing.
  return tokens.reverse().flatMap(([first, ...rest]) => (kind(first!) === "heading" ? [first!, ...rest.reverse()] : [first!, ...rest].reverse()));
}
