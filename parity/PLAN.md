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
- `tools/record.sh [native|web|all] [take...]` records every interaction at 60fps. `SUF=-g BG=808080` records on plain grey, where `tools/shape.py` reads the glass's size frame by frame. `tools/px.py` reads colours and edges from a picture.
- `tools/video.sh out.mp4` builds a side-by-side film from the recordings, lined up on the frame each side starts to move.
- `./run.sh stop` cleans up.

Don't judge glass with Playwright's desktop WebKit: it doesn't draw backdrop filters. Use the simulator. Don't judge it in Chromium's headless software renderer either: it draws sharp stripes along the right and bottom of any backdrop blur, even on a plain `backdrop-filter: blur()`. `tools/chromium.cjs` turns on the GPU, where they're gone.

Give the page a few seconds after launching before a gesture, more if the Mac is busy: `record.sh` waits 4.5s (`SETTLE`). After `./run.sh ui` or starting the driver, run `./run.sh install` again, once the driver's up: the driver installs a build without the web files, and every web page comes up white.

## What iOS 27 measures

| Glass | Regular | Clear |
|---|---|---|
| Blur | 15.3pt | 1.3pt |
| Light mode | lifts the backdrop (black reads about 135, white 254), then saturates about 2x | black reads 32, slope 0.95, saturates 1.12 |
| Dark mode, 120pt and taller | black 32, peaks at 129 over light grey, 121 over white | same as light |
| Dark mode, 60pt and shorter | black 32, 134 over mid grey, 185 over white | same as light |

- **Corners:** continuous. A superellipse of power 2.5 reaching 1.2x the radius along each edge follows alerts, sheets, menus and panels to about a quarter of a point. Alerts and menus are radius 33, sheets 38.
- **Bend:** samples inward by about a third of the height at the edge, falling in a straight line to nothing, across about 5pt on a 44pt pill and 9.5pt on a 120pt panel.
- **Rim:** lit from straight above and below: a bright line about 1pt deep on the top and bottom, a dark hairline in the outer 2 device pixels of the sides.
- **Shadow:** barely any on a button; `0 8px 21px` at 7% on a 120pt panel, 11% in dark mode.
- **Ink:** primary text is pure black in light mode. Secondary text takes up the colour behind it.
- **Button:** 30, 36 and 52pt tall with 15 and 17pt labels. Pressing grows the long side about 16pt, lightens the glass by about a third towards white and fades a light-mode label to 77%; release dips about 29% past rest. A filled button is opaque and lightens 12% towards white.
- **Switch and slider thumbs:** 37 x 24pt with no rim at rest. Under a finger, a sharp 59 x 38pt lens: no blur, no lift, a dark outline. A quick tap keeps the lens up for about 300ms, for the trip. A slider ignores a tap on its track, and a drag moves the thumb by as much as the finger moves, wherever it took hold.
- **Segmented control:** a flat fill at rest, with a thumb 4pt narrower than its segment. Under a finger the thumb is a sharp lens 25pt wider and 44pt tall, over the labels, which bend at its rim. It follows a drag from the thumb. A tapped segment is reached by the lens, which settles flat when it arrives, about 300ms later. The settling wobble in the thumb's width isn't copied.
- **Menu:** 250pt wide, 42pt rows, 17pt type, centred on its trigger. Opening, the pill squeezes into a ball about 106pt wide as it falls past the menu's centre, then swells out with very round corners; the items zoom to about 1.28x on the way. Closing runs the other way and ends in a drop that merges into the trigger, which comes back about 7pt high and 2% wide. The frames are tabled in `src/menu.tsx`.
- **Tab bar:** 275 x 62pt with three tabs, 94 x 53pt selection growing to 117 x 73pt under a finger, 28pt icons, 10pt labels. The selection deepens the colour behind it rather than greying it. Under a finger the whole bar swells about 5%, and a quick tap keeps the lens up for about 230ms. Minimised: 49 x 39pt.
- **Sheet:** at half height 451pt tall, floating glass inset 8pt all round; at full height opaque and edge to edge, 67pt from the top. It launches fast and settles without overshoot. Grabber 57 x 4pt.
- **Alert:** 320 x 156pt, 48pt pill buttons in medium weight, a little below centre, settling from about 1.125x over 240ms. The scrim is 20% black in light mode and 48% in dark.

## Status

### Matched and measured
- Glass colour in Chromium: 1.6 levels rms in light and 1.5 in dark at panel size, 2.0 and 1.6 at button size, over 18 colours (measured before the changes to Safari's dark tone, which Chromium doesn't use).
- Glass colour in Safari, light: 1.8 levels rms at panel size. A panel on grey reads 196 against iOS's 197.
- Button press and release: peak and dip within 1pt of the recording.
- Menu opening, frame by frame on iOS WebKit: height and centre identical, width within 4pt.
- Sheet opening, frame by frame: within 2pt of the recording once under way. The first two frames or so are lost while the glass reaches the screen.
- Alert opening: scale within a few points frame by frame, losing the first frame or so the same way.

### Matched by eye, side by side
- Rim and shadow, built from the readings above. The last numeric comparison was before the final rim, so these want one more reading.
- Sheet and alert at rest, switch and slider at rest and under a finger, tab bar and its lens, menu closing, continuous corners.
- Stepper, progress, spinner, toolbar and merged glass: not looked at again in this pass.

### Close, with known differences
- **Dark mode in Safari:** its filters are linear and iOS's curve isn't, so it's the closest straight line. A brightness above 1 doesn't clip between filters in WebKit, so a knee can't be built from them (tried). Swept over 18 colours in rms levels: 19.9 at panel size, down from 24.3, and 9.6 at button size. Over black it's 36 at panel size and 40 at button size, where iOS is 32; over `#1c1c1e` a menu is 51 where iOS is 53. White backdrops are worst, at 176 where iOS is 121. Mid-dark greys came out a little darker than before, 9.4 from 7.7 for greys up to `808080`.
- **What shows through the glass:** iOS's blur lets a faint blocky ghost of the backdrop through, faint in light mode and plain to see in dark, where a grid's lines stay visible. CSS's blur is smooth, so ours shows none of it.
- **Secondary text and the grabber:** black at an opacity picks up the backdrop's colour but not as strongly as iOS's vibrancy, which blends. A blend can't reach the glass from inside it in WebKit (tried `multiply`, `plus-darker` and `color-burn`).
- **A press in dark mode:** the glass lightens by the right amount but greyer than iOS's.
- **Tab bar icons and labels:** icons come from the app, so they won't be SF Symbols. The tab bar's own test icons only approximate them.
- **The menu's drop:** it joins the trigger with a straight seam, where iOS's glass merges with a smooth neck. It lasts about 100ms.
- **Search field:** the `fill` variant's height is unmeasured.
- **The tinted end of `--lg-transparency`:** not compared with the real iOS setting.
- **Changing `--lg-transparency` after mount:** the lens doesn't refit until the size changes.
- **Switch, slider and tab lens motion:** compared side by side frame by frame, not fitted to numbers the way the press, menu and sheet are.
- **Context menu:** built to the same measurements as the menu, not compared under a finger. It doesn't have the menu's morph.

### Not done
- **A bend for marked backdrops in Safari.** It could be faked for images with rings of scaled copies, but under 15pt of blur it would barely show, and nothing here uses it yet.
- **Firefox and a real iPhone.** So far: iOS WebKit on the simulator and Chromium. Firefox has neither `corner-shape` nor the mask, so its corners stay circular under a continuous rim. Performance was last checked in headless Chromium and desktop WebKit: 60fps at idle, with milliseconds to build the rims.

## What a web page can't do

- **Safari can't bend live content.** Only Chromium lets a page run a lens over what's behind an element.
- **No haptics, and no system-level glass**, such as over the status bar or other apps.
- **San Francisco and SF Symbols are Apple's.** Elsewhere the type falls back to the system font.
