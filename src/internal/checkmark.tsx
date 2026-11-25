import type { JSX } from "react";

/** The tick beside the chosen row of a menu. (Menu draws its own copy; they can be one once the open menu changes are merged.) */
export const checkmark: JSX.Element = (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" aria-hidden>
    <path d="m2.75 7.25 2.75 2.75 5.75-6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
