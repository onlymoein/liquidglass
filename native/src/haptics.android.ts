import { native } from './native';

/**
 * A tick under the finger, as iOS's controls give: `on` and `off` for a switch, `select` for a new
 * segment or tab, `tick` for a step or reaching the end of a slider.
 */
export const haptic = (kind: 'on' | 'off' | 'select' | 'tick'): void => native?.haptic?.(kind);
