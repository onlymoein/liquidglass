# Matching iOS 27

The goal is that a page using this library looks and moves like a native iOS 27 app, as far as a browser allows. Values come from measuring real iOS controls with this rig, not from judging by eye. Reference: Xcode 27.2, iOS 27.0 simulator, iPhone 17.

## Using the rig

Run these from `parity/`, in bash (zsh doesn't split the size lists in the tools).

- `./run.sh build && ./run.sh start` builds and installs the test app.
- `./run.sh shot native|web light|dark out.png -scene all -bg grid` takes one picture.
- `./run.sh ui`, then `./run.sh drive` in the background, runs the gesture driver. `./run.sh do tap 201 266` sends a gesture to real controls or the web page alike, and `./run.sh snap x out.png` takes a picture of what's there.
- `tools/capture.sh` records a gesture at 60fps and `tools/track.py` traces its shape over time.
- `tools/colors.sh`, `tools/chromium-colors.cjs`, `tools/fit.py`, `tools/rim.py`, `tools/boxes.py`, `tools/lens.sh` and `tools/sizes.sh` read colour, fit filters, read rims, measure sizes, read the bend and read the effect of size.
- `tools/chromium.cjs` renders a page in Chromium. It needs `playwright-core`, currently read from a sibling project.
- `./run.sh stop` cleans up.

Don't judge glass with Playwright's desktop WebKit: it doesn't draw backdrop filters. Use the simulator.

## What iOS 27 measures

| Glass | Regular | Clear |
|---|---|---|
| Blur | 15.3pt | 1.3pt |
| Light mode | lifts the backdrop (black reads about 135, white 254), then saturates about 2x | black reads 32, slope 0.95, saturates 1.12 |
| Dark mode, 120pt and taller | black 32, peaks at 129 over light grey, 121 over white | same as light |
| Dark mode, 60pt and shorter | black 32, 134 over mid grey, 185 over white | same as light |

- **Bend:** samples inward by about a third of the height at the edge, falling in a straight line to nothing, across about 5pt on a 44pt pill and 9.5pt on a 120pt panel.
- **Rim:** lit from straight above and below: a bright line about 1pt deep on the top and bottom, a dark hairline in the outer 2 device pixels of the sides.
- **Shadow:** barely any on a button; `0 8px 21px` at 7% on a 120pt panel, 11% in dark mode.
- **Button:** 30, 36 and 52pt tall with 15 and 17pt labels. Pressing grows the long side about 16pt; release dips about 29% past rest.
- **Menu:** 250pt wide, 42pt rows, 17pt type, radius 34, centred on its trigger, overshooting about 12% as it opens.
- **Tab bar:** 275 x 62pt with three tabs, 94 x 53pt selection growing to 117 x 73pt under a finger, 28pt icons, 10pt labels. Minimised: 49 x 39pt.
- **Sheet:** at half height (52%) floating glass inset 8pt with radius 46; at full height opaque and edge to edge, 67pt from the top. It launches fast and settles without overshoot.
- **Alert:** 320pt wide, radius 36, 48pt pill buttons, a little below centre, settling from 1.04x. The scrim is 20% black in light mode and 48% in dark.

## Status

### Matched and measured
- Glass colour in Chromium: 1.6 levels rms in light and 1.5 in dark at panel size, 2.0 and 1.6 at button size, over 18 colours.
- Glass colour in Safari, light: 1.8 levels rms at panel size.
- Button press and release: peak and dip within 1pt of the recording.
- Menu opening: peak and timing within a few points and about 20ms. Its layout was compared by eye, side by side, and looks almost identical.

### Matched by eye, side by side
- Rim and shadow, built from the readings above. The last numeric comparison was before the final rim, so these want one more reading.
- Sheet, alert, segmented control, stepper, progress, spinner, toolbar, switch and slider at rest and under a finger, tab bar, tab lens, merged glass.

### Close, with known differences
- **Dark mode in Safari:** about 27 levels rms over the full sweep at panel size. Greys are within 4 from dark to mid grey and 14 on black; bright backdrops are worst, up to 63 on white. Its filters are linear and iOS's curve isn't.
- **Corners:** iOS uses continuous corners and CSS draws circular ones. Chromium's `corner-shape` could do it, but the rim would need to follow.
- **Tab bar icons and labels:** icons come from the app, so they won't be SF Symbols. Label weight is close but unmeasured.
- **Search field:** the `fill` variant's height is unmeasured.
- **The tinted end of `--lg-transparency`:** not compared with the real iOS setting.
- **Changing `--lg-transparency` after mount:** the lens doesn't refit until the size changes.
- **Sheet and alert motion, switch and slider motion, and tab lens motion:** not fitted the way the press and menu are. The sheet follows its traced curve but wasn't re-traced.
- **Context menu:** built to the same measurements as the menu, not compared under a finger.

### Not done
- **A bend for marked backdrops in Safari.** It could be faked for images with rings of scaled copies, but under 15pt of blur it would barely show, and nothing here uses it yet.
- **Firefox and a real iPhone.** So far: iOS WebKit on the simulator and headless Chromium. Performance was checked in headless Chromium and desktop WebKit only: 60fps at idle, with milliseconds to build the rims.

## What a web page can't do

- **Safari can't bend live content.** Only Chromium lets a page run a lens over what's behind an element.
- **No haptics, and no system-level glass**, such as over the status bar or other apps.
- **San Francisco and SF Symbols are Apple's.** Elsewhere the type falls back to the system font.
