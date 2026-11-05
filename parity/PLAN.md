# Matching iOS 27

The goal is that a page using this library can't be told apart from a native iOS 27 app, as far as a browser allows. Every value comes from measuring real iOS glass with this rig, not from judging by eye.

`./run.sh build && ./run.sh start`, then `./run.sh shot native|web light|dark out.png -scene all -bg grid`. `tools/colors.sh` sweeps colours, `tools/lens.sh` reads the bend, `tools/fit.py` fits filters, `tools/chromium.cjs` renders the same page in Chromium (it needs `playwright-core`, currently read from a sibling project). `./run.sh stop` cleans up. Reference: Xcode 27.2, iOS 27.0 simulator, iPhone 17.

## What iOS 27 glass measures

| | Regular | Clear |
|---|---|---|
| Blur | 15.3pt | 1.3pt |
| Light mode | lifts the backdrop (black reads 135, white 254), then saturates about 2x | black reads 32, slope 0.95, saturates 1.12 |
| Dark mode | black reads 32, peaks at 129 near light grey, falls to 121 on white | same as light |

- **Size:** the centre of the glass reads the same from 44pt to 400pt.
- **Bend:** samples inward by about a third of the height at the edge, falling in a straight line to nothing. The bezel is about 5pt on a 44pt pill and 9.5pt on a 120pt panel.
- **Light:** from straight above and below. Top and bottom have a bright line and a soft glow; the sides have a dark hairline.
- **Buttons:** 36pt regular and 52pt large, with 17pt labels. Filled fill is about 87% opaque in light mode and 95% in dark.
- **Tab bar:** 275 x 62pt with three tabs, 94 x 53pt selection, 28pt icons, 10pt labels.

## Phases

### 1. Material: mostly done
- [x] Measurement rig
- [x] Colour: light 1.8 levels rms against iOS, clear 0.3 in the fit
- [x] Blur, with the lens inside one filter in Chromium
- [x] Rim lit from above and below
- [x] Edge bend strength in Chromium
- [x] Safari's marked backdrop no longer loses its blur and colour
- [ ] Dark mode curve: 27 levels rms over the full colour sweep. Greys are within 4 from dark to mid grey and 14 on black; bright backdrops are worst, up to 63 on white. It needs a luminance curve that CSS filters can't express. Chromium can do it exactly with an SVG filter; Safari stays an approximation
- [ ] Measure the rig's rim and shadow against iOS numerically, not only by eye
- [ ] The tinted end of `--lg-transparency`, against the real iOS setting
- [ ] Refit the lens if `--lg-transparency` changes after mount

### 2. Controls, one at a time: started
- [x] Button sizes and filled fill
- [x] Tab bar with icons: size, selection, tint
- [ ] Button: measure `small`; pressed and disabled states
- [ ] Tab bar: icon sizing, label weight, and the lens's colour on vivid backdrops
- [ ] Switch, Slider: thumbs use their own filter, not the new material
- [ ] Input, SearchField, Toolbar
- [ ] Menu: rows, type, surface. It still has its own blur and tint
- [ ] Label colours that adapt to what's behind them

### 3. Motion: not started
XCUITest (`xcodegen` is available) can tap real controls while the simulator records, so springs can be fitted from frames.
- [ ] Button press swell and release
- [ ] Switch and slider thumb lift
- [ ] Tab lens drag
- [ ] Menu morph, open and close

### 4. Missing pieces: not started
- [ ] Glass that merges as shapes come close (`GlassEffectContainer`)
- [ ] Sheet with detents, and a dialog that grows from its button
- [ ] Segmented control, stepper, progress, context menu, toast
- [ ] Tab bar that shrinks on scroll
- [ ] Morph for the app's existing menus, popovers and selects

### 5. Safari and shipping: not started
- [ ] A bend for marked backdrops in Safari without SVG filters, such as rings of scaled copies
- [ ] Check desktop Safari, Firefox and a real iPhone. So far: iOS WebKit on the simulator, headless Chromium
- [ ] Performance: the lens map is now larger and drawn at up to 3x
- [ ] A demo page
- [ ] Release, and move Rush Job over, checking its button overrides against the new defaults

## What a web page can't do

- **Safari can't bend live content.** Browsers other than Chromium don't let a page read or filter the pixels behind an element through an SVG lens. Only marked content can ever bend there.
- **Dark mode in Safari is approximate.** Its filters are linear between steps, and iOS's curve isn't.
- **No haptics, and no system-level glass** such as over the status bar or other apps.
- **San Francisco is only available on Apple devices.** Elsewhere the type falls back to the system font.
