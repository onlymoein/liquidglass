// The tab bar's springs, as [stiffness, damping, lift stiffness, lift damping]. A spring's
// damping ratio is damping / (2 * sqrt(stiffness)): 1 settles without overshooting, lower
// swings past the target and back.

// At rest the lens swings a little past the tab it's going to and settles back, the fluid
// jiggle of iOS's glass. It had been damped almost critically (0.92), so it slid across in
// about 110 ms with nothing of that. Now the ratio is 0.7: nine tenths of the way takes
// about 170 ms, it reaches the tab as a quick tap's lift lets go (230 ms), overshoots by
// 4.6% and is still for good after about 430 ms. The lift has its own, quicker spring.
// Chosen by eye from the feel of iOS, not measured on the simulator: refit it from a recording.
export const REST = [225, 21, 676, 47.8] as const;

// Under a finger the lens has to keep up with it, so this is stiff and nearly critical.
export const DRAG = [2500, 94, 576, 44.2] as const;
