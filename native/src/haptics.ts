/** Ticks are iOS's own on iOS, and there are none on the web. */
export const haptic = (_kind: 'on' | 'off' | 'select' | 'tick'): void => {};
