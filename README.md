# liquidglass

[![web package on npm](https://img.shields.io/npm/v/@onlymoein/liquidglass?logo=react&label=react%20(web))](https://www.npmjs.com/package/@onlymoein/liquidglass)
[![native package on npm](https://img.shields.io/npm/v/@onlymoein/liquidglass-native?logo=expo&label=react%20native)](https://www.npmjs.com/package/@onlymoein/liquidglass-native)
[![TypeScript types included](https://img.shields.io/npm/types/@onlymoein/liquidglass?logo=typescript&logoColor=white)](https://www.npmjs.com/package/@onlymoein/liquidglass)
[![live demo](https://img.shields.io/website?url=https%3A%2F%2Fonlymoein.github.io%2Fliquidglass%2F&label=live%20demo)](https://onlymoein.github.io/liquidglass/)
[![license](https://img.shields.io/npm/l/@onlymoein/liquidglass)](https://github.com/onlymoein/liquidglass/blob/main/LICENSE)

**Apple's iOS 27 Liquid Glass for React and React Native.** Glass that bends the light behind it, and the iOS controls built from it (buttons, switches, sliders, menus, sheets, tab bars), moving the way the real ones do.

**[Try it live in your browser →](https://onlymoein.github.io/liquidglass/)**

## Pick your package

| You're building | Install | Runs on | How the glass is drawn |
| --- | --- | --- | --- |
| **A website or web app**: React, Next.js, Vite, Remix | `npm install @onlymoein/liquidglass` | Chrome, Edge, Safari, Firefox | Its own glass, matched to iOS 27 on the simulator |
| **A mobile app**: React Native, Expo | `npx expo install @onlymoein/liquidglass-native expo-glass-effect` | iOS and Android | iOS: Apple's own glass and controls. Android: its own glass, to iOS's measurements |

Both packages use the same component names, so `Button`, `Switch`, `Slider`, `Menu`, `TabBar` and the rest work the same way in each.

<table>
  <tr>
    <td align="center" width="50%"><a href="https://onlymoein.github.io/liquidglass/"><img src="https://raw.githubusercontent.com/onlymoein/liquidglass/main/assets/liquidglass-site.gif" width="400" alt="Recording of the live site: a glass lens dragged across the word liquidglass, pieces of glass merging, and a segmented control's thumb lifting into a lens."></a></td>
    <td align="center" width="50%"><a href="https://github.com/onlymoein/liquidglass/blob/main/assets/liquidglass-v0.10-parity.mp4"><img src="https://raw.githubusercontent.com/onlymoein/liquidglass/main/assets/liquidglass-v0.10-parity.gif" width="400" alt="Side-by-side recording of native iOS 27 controls and liquidglass: buttons, switch, slider, menu, alert, sheet and tab bar."></a></td>
  </tr>
  <tr>
    <td align="center"><b>Web</b>: the live site, in Chrome</td>
    <td align="center"><b>Web vs iOS</b>: native iOS 27 on the left, liquidglass on the right (<a href="https://github.com/onlymoein/liquidglass/blob/main/assets/liquidglass-v0.10-parity.mp4">video</a>)</td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/onlymoein/liquidglass/blob/main/native/assets/demo-ios.mp4"><img src="https://raw.githubusercontent.com/onlymoein/liquidglass/main/native/assets/demo-ios.gif" width="260" alt="Recording of the React Native example app on iOS 27: switch, slider, stepper, segmented control, menu, the tab bar's lens, and the tab bar shrinking as the page scrolls."></a></td>
    <td align="center"><a href="https://github.com/onlymoein/liquidglass/blob/main/native/assets/demo-android.mp4"><img src="https://raw.githubusercontent.com/onlymoein/liquidglass/main/native/assets/demo-android.gif" width="260" alt="The same gestures in the example app on Android, with this package's glass."></a></td>
  </tr>
  <tr>
    <td align="center"><b>React Native on iOS 27</b> (<a href="https://github.com/onlymoein/liquidglass/blob/main/native/assets/demo-ios.mp4">video</a>)</td>
    <td align="center"><b>React Native on Android</b> (<a href="https://github.com/onlymoein/liquidglass/blob/main/native/assets/demo-android.mp4">video</a>)</td>
  </tr>
</table>

## Contents

- [Quick start: React (web)](#quick-start-react-web)
- [Quick start: React Native and Expo](#quick-start-react-native-and-expo)
- [Components](#components)
- [Using the web components](#using-the-web-components)
- [Look and theme](#look-and-theme)
- [Browser support](#browser-support)
- [Performance](#performance)
- [For coding agents](#for-coding-agents)
- [Coming from glisse](#coming-from-glisse)

## Quick start: React (web)

```bash
npm install @onlymoein/liquidglass
```

```tsx
import { Button, Glass, Switch } from "@onlymoein/liquidglass";

export function Settings() {
  return (
    <Glass style={{ borderRadius: 28, padding: 20 }}>
      <Switch aria-label="Wi-Fi" defaultChecked />
      <Button variant="filled">Continue</Button>
    </Glass>
  );
}
```

That's all the setup there is. Each component brings its own CSS the first time it renders. If you'd rather load all the CSS up front, import `@onlymoein/liquidglass/styles.css` once.

- React 18 or later. Works with Next.js (the components are client components), Vite, Remix and anything else that renders React in the browser.
- Glass shows what's behind it, so put it over a photo, a gradient or content that scrolls. Over a plain white page it's a faint grey card.

## Quick start: React Native and Expo

```bash
npx expo install @onlymoein/liquidglass-native expo-glass-effect
npx expo run:ios   # or run:android
```

```tsx
import { Button, Glass, Slider, Switch } from "@onlymoein/liquidglass-native";

export function Player() {
  return (
    <Glass style={{ padding: 16, borderRadius: 28, gap: 12 }}>
      <Switch defaultChecked />
      <Slider defaultValue={0.5} />
      <Button label="Done" variant="filled" onPress={() => {}} />
    </Glass>
  );
}
```

- Expo SDK 54 or later (React Native 0.81 or later). It has native code, so it needs a development build or EAS Build; it doesn't run in Expo Go.
- **iOS:** the components are Apple's own UIKit glass and controls, so they look exactly like Apple's apps.
- **Android:** the package draws the glass itself. Wrap what the glass should show in a `Backdrop`.

The full guide is in the **[React Native README](native/)**: icons, fonts, the tab bar and Android.

## Components

| Component | What it is | Web | React Native |
| --- | --- | :---: | :---: |
| `Glass` | A plain piece of glass to put anything on | ✓ | ✓ |
| `GlassGroup` | Glass that flows together when pieces come close | ✓ | ✓ |
| `Button` | A glass or filled button in the iOS sizes, with an optional icon or tint | ✓ | ✓ |
| `Switch` | An on/off switch with a glass thumb | ✓ | ✓ |
| `Slider` | A slider with a glass thumb | ✓ | ✓ |
| `Stepper` | Two buttons that step a number down and up | ✓ | ✓ |
| `SegmentedControl` | A row of choices with a thumb that lifts into a lens under a finger | ✓ | ✓ |
| `Menu` | A menu that grows out of its button | ✓ | ✓ |
| `TabBar` | Tabs with a lens that follows the finger | ✓ | ✓ |
| `Toolbar`, `ToolbarGroup` | A bar of actions that frosts as content scrolls under it | ✓ | |
| `NavigationBar` | A screen's top bar: back button, actions, a large title that slides into the bar | ✓ | |
| `Input`, `SearchField` | Text fields set in glass | ✓ | |
| `ContextMenu` | A menu that opens when you hold something down or right-click it | ✓ | |
| `Sheet` | A sheet that rises from the bottom and drags between heights | ✓ | |
| `Alert` | A modal question with pill buttons | ✓ | |
| `PageControl` | Page dots on a capsule of glass | ✓ | |
| `Progress`, `Spinner` | A progress bar and the activity indicator | ✓ | |
| `Backdrop`, `Text`, `ScrollView` | What glass shows on Android, an iOS-like typeface, and iOS's bounce | | ✓ |

Every control can be **controlled** (`value` / `checked` / `open` with `onValueChange` / `onCheckedChange` / `onOpenChange`) or **uncontrolled** (`defaultValue` / `defaultChecked` / `defaultOpen`).

## Using the web components

### Toolbar

```tsx
import { Button, Toolbar, ToolbarGroup } from "@onlymoein/liquidglass";

<Toolbar aria-label="Notes">
  <ToolbarGroup aria-label="Navigation">
    <Button>Back</Button>
  </ToolbarGroup>
  <ToolbarGroup aria-label="Actions">
    <Button>Share</Button>
    <Button>Edit</Button>
  </ToolbarGroup>
</Toolbar>
```

Put it first inside whatever scrolls; it sticks to the top. Buttons in one group share a piece of glass. When content scrolls under the bar, a frosted band fades in, as on iOS 27. Use `edge="soft"` for iOS 26's lighter blur, or `edge="none"` for neither. The arrow keys move between actions.

### NavigationBar

```tsx
import { Button, NavigationBar, ToolbarGroup } from "@onlymoein/liquidglass";

<NavigationBar
  title="Inbox"
  onBack={goBack}
  trailing={
    <ToolbarGroup aria-label="Actions">
      <Button aria-label="Compose" icon={<ComposeIcon />} />
    </ToolbarGroup>
  }
/>
```

A `Toolbar` with a title. The title starts large and scrolls away with the content, and a smaller one fades into the bar once it's gone. `large={false}` keeps the small title from the start. `onBack` adds the round back button, and `leading` and `trailing` hold other actions.

### Menu

```tsx
import { Menu } from "@onlymoein/liquidglass";

<Menu
  aria-label="Account"
  label="Account"
  items={[
    { heading: "Appearance" },
    { label: "Light", checked: theme === "light", keepOpen: true, onSelect: () => setTheme("light") },
    { label: "Dark", checked: theme === "dark", keepOpen: true, onSelect: () => setTheme("dark") },
    "separator",
    { label: "Sign out", destructive: true, onSelect: signOut },
  ]}
/>
```

- With a `label` the trigger is a pill, like iOS's pull-down button. Without one it's a round button with an ellipsis or your `icon`.
- `align` lines the menu up with the trigger's `start`, `center` or `end`. `trigger` passes props to the trigger button, such as `{ variant: "filled" }`.
- An item with `href` is a link: `onSelect` runs instead if it's given, for your router, and ⌘, Ctrl, Shift or the middle button opens a new tab.
- `checked` shows a checkmark, and `keepOpen` leaves the menu open so the change can be seen.
- It opens in the top layer, so nothing around the trigger can clip it.

### Sheet and Alert

```tsx
import { Alert, Sheet } from "@onlymoein/liquidglass";

<Sheet aria-label="Details" open={open} onOpenChange={setOpen}>
  {details}
</Sheet>

<Alert
  open={asking}
  onOpenChange={setAsking}
  title="Delete shipment?"
  message="This can't be undone."
  actions={[{ label: "Cancel", role: "cancel" }, { label: "Delete", role: "destructive", onSelect: remove }]}
/>
```

A sheet rests at half height as floating glass, and at full height as an opaque panel. `detents` chooses which heights it has. Drag it from anywhere, not just the handle. Scrolling content inside it hands drags back and forth as on iOS. Drags that start on a slider, a text field or anything marked `data-lg-no-sheet-drag` stay with that element.

### TabBar

Give items an `icon` for the 62-point iOS tab bar. `minimized` shrinks it to the current tab's icon, as iOS does when a page scrolls down, and `onExpand` tells you when that icon is tapped. Items with an `href` render through `link`, such as Next.js's `Link`.

### GlassGroup

```tsx
import { Button, GlassGroup } from "@onlymoein/liquidglass";

<GlassGroup spacing={20} style={{ gap: 6 }}>
  <Button aria-label="Add" icon={<PlusIcon />} />
  <Button aria-label="Edit" icon={<PencilIcon />} />
</GlassGroup>
```

Glass closer together than `spacing` becomes one shape, and parts again as it moves away.

### Popups from other libraries

Add the class `lg-grow` to a popup from Radix, Base UI or similar. It then grows out of its `transform-origin` on `data-open` and shrinks away on `data-closed`, with the menu's spring.

## Look and theme

**Light and dark** follow the system. To pin one, set `data-theme="light"` or `data-theme="dark"` on any element.

**Transparency** works like the iOS 27 setting. `--lg-transparency` runs from `0` (fully tinted) through `0.5` (regular, the default) to `1` (clear). Set it anywhere and the glass inside follows. If someone's system is set to reduce transparency or increase contrast, glass is fully tinted, as on iOS.

```css
:root {
  --lg-transparency: 0.8;
}
```

**Colours** are CSS variables you can override:

| Variable | What it sets |
| --- | --- |
| `--lg-fill` | The accent colour of filled buttons and sliders |
| `--lg-on` | A switch that's on |
| `--lg-glass-tinted` | The tint when `--lg-transparency` is below `0.5` |
| `--lg-shine` | How strong the rim's lines are; `1` matches iOS 27 |
| `--lg-contrast`, `--lg-brightness`, `--lg-saturate` | What glass does to what's behind it (add `-small` for glass 60 points tall or less) |

## Browser support

| Browser | Colour, blur and rim | Edge bends like iOS |
| --- | :---: | :---: |
| Chrome, Edge, and other Chromium browsers | ✓ | ✓ |
| Safari (Mac, iPhone, iPad) | ✓ | |
| Firefox | ✓ | Over content you mark |

Only Chromium lets a page bend what's behind an element. Everywhere else the glass looks the same, but its edge doesn't bend.

In Firefox, put `data-liquidglass-backdrop` on what sits behind the glass, such as a wallpaper or hero image, and the glass bends a copy of it. Keep it to a small area, since everything inside it is copied for every piece of glass over it. Safari ignores the attribute.

```tsx
<img data-liquidglass-backdrop src="/wallpaper.jpg" alt="" />
```

**How close it is to iOS 27.** `parity/` runs real iOS controls and this library on the same simulator, over the same backgrounds and through the same taps, and measures the difference. In Chromium, glass colour is within 2 levels out of 255 of iOS in both themes. Safari is within 2 levels in light mode and approximate in dark mode. Button presses and menu openings are fitted to recordings of the real thing.

## Performance

- The lens maps and rims are drawn in a Web Worker, off the page's thread. Glass appears frosted at once and picks up its lens a moment later.
- Maps are freed once no glass uses them, so resizing doesn't pile them up.
- On the demo, Lighthouse mobile scores 99, with no time blocked and no dropped frames while scrolling.
- One `Button` adds about 12 kB to a site, minified and compressed. Bundlers drop the components you don't use.
- **Content Security Policy:** allow `worker-src blob:` and `img-src blob: data:`. Without the worker, the same glass is drawn on the page instead.

Every pull request checks `npm run size`, `npm run perf:lighthouse` and `npm run perf:frames`. The frames check covers scrolling, Firefox's copied backdrop and resizing the window.

## For coding agents

An agent skill teaches Claude Code, Cursor, Codex and other agents both packages: the components, theming, browser differences and what to check when glass looks wrong.

```bash
npx skills add onlymoein/liquidglass
```

It also ships in the web package, at `node_modules/@onlymoein/liquidglass/skills/liquidglass/SKILL.md`.

## Coming from glisse

liquidglass started as a fork of [glisse](https://github.com/0kzh/glisse) by Kelvin Zhang. The components and props are the same. Install `@onlymoein/liquidglass`, change your imports, and rename `data-glisse-backdrop` to `data-liquidglass-backdrop`. If you set `--lg-glass`, set `--lg-glass-tinted` and `--lg-transparency` instead.

## License

MIT. Copyright Kelvin Zhang and Moein Saharkhiz.
