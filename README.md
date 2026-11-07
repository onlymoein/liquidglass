# liquidglass

Apple's iOS 27 Liquid Glass for React: glass that bends the light behind it, with controls that move like the real ones.

It started as a fork of [glisse](https://github.com/0kzh/glisse) by Kelvin Zhang. Its look and motion are now measured against real iOS 27 on the simulator; see [How close it is](#how-close-it-is-to-ios-27).

<a href="https://github.com/onlymoein/liquidglass/blob/main/assets/liquidglass-v0.10-parity.mp4"><img src="https://raw.githubusercontent.com/onlymoein/liquidglass/main/assets/liquidglass-v0.10-parity.gif" width="546" alt="Side-by-side recording of native iOS 27 controls and liquidglass: buttons, switch, slider, menu, alert, sheet and tab bar."></a>

Left is native iOS 27. Right is liquidglass, recorded on 0.10. [Watch the full video](https://github.com/onlymoein/liquidglass/blob/main/assets/liquidglass-v0.10-parity.mp4).

**[Try it live](https://onlymoein.github.io/liquidglass/)**: drag the glass, tune it, and use every control.

## Usage

Install it:

```bash
npm install @onlymoein/liquidglass
```

Then use the components anywhere. Their styles come with them.

```tsx
import { Button, Switch } from "@onlymoein/liquidglass";

function Settings() {
  return (
    <div>
      <Switch aria-label="Wi-Fi" defaultChecked />
      <Button variant="filled">Continue</Button>
    </div>
  );
}
```

React 18 or later.

## Components

| Component | |
| --- | --- |
| `Glass` | A plain piece of glass to put anything on. |
| `Button` | A glass or filled button in the iOS sizes (`small`, `regular`, `large`), with an optional icon, tint or destructive style. |
| `Toolbar`, `ToolbarGroup` | A bar of actions that frosts as content scrolls under it. |
| `TabBar` | Tabs with a lens that follows your finger between them. Give items an `icon` for the iOS tab bar. |
| `Switch` | An on/off switch with a glass thumb. |
| `Slider` | A slider with a glass thumb. |
| `Input`, `SearchField` | Text fields set in glass. |
| `Menu` | A menu that grows out of its trigger. |
| `ContextMenu` | A menu that opens when you hold something down or right-click it. |
| `Sheet` | A sheet that rises from the bottom, floats at half height and drags between its heights. |
| `Alert` | A modal question with pill buttons. |
| `SegmentedControl` | A row of choices with a thumb that slides to the chosen one, and lifts into a clear lens under a finger. |
| `Stepper` | Two buttons that step a number down and up. |
| `Progress`, `Spinner` | A thin progress bar and the activity indicator. |
| `GlassGroup` | Glass inside it flows together as it comes close, like `GlassEffectContainer`. |

Controls with a value take it controlled (`value` / `checked` / `open` with a change handler) or uncontrolled (`defaultValue` / `defaultChecked` / `defaultOpen`).

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

The toolbar sticks to the top of whatever scrolls around it. Buttons in a group share one piece of glass. Once content scrolls under the bar, a frosted band fades in behind it, as on iOS 27. Pass `edge="soft"` for the lighter iOS 26 blur, or `edge="none"` for neither. The arrow keys, Home and End move between its actions.

### Menu

```tsx
import { Menu } from "@onlymoein/liquidglass";

<Menu
  aria-label="Shipment options"
  label="Create shipment"
  icon={<PlusIcon />}
  align="start"
  items={[{ label: "Parcel", onSelect: newParcel }, { label: "Freight", onSelect: newFreight }]}
/>
```

With a `label`, the trigger is a pill, like an iOS pull-down button, and the pill itself stretches into the menu. Add `chevron` if you want one; iOS doesn't draw one here. Without a label, it's a round button with an ellipsis or your `icon`.

The menu centres on its trigger, or lines up with an edge through `align`, and moves in from the side of the window if it has to. It's at least 250 points wide, as wide as its longest row, and every row is one line. `trigger` passes anything else to the trigger button, such as `{ variant: "filled" }` or your own `className`.

Give an item an `href` to make it a link. Choosing it calls `onSelect` if there is one, such as your router's navigate, and follows the link if not. ⌘, Ctrl, Shift or the middle button opens it in a new tab.

Items can also be a set of choices, with a checkmark on the chosen one, under a small heading:

```tsx
<Menu
  aria-label="Account"
  items={[
    { heading: "Appearance" },
    { label: "Light", checked: theme === "light", keepOpen: true, onSelect: () => setTheme("light") },
    { label: "Dark", checked: theme === "dark", keepOpen: true, onSelect: () => setTheme("dark") },
    "separator",
    { label: "Sign out", destructive: true, onSelect: signOut },
  ]}
/>
```

`keepOpen` leaves the menu open after the item is chosen, so what it changed can be seen. `className` on an item is passed to its row. `chevron={false}` leaves the chevron off a labelled trigger.

The menu opens in the top layer, so nothing that scrolls or clips around the trigger can cut it off, and nothing on the page can sit above it. It covers its trigger and grows down from it, or up when there isn't room below, and stays inside the window. A menu taller than the room there is scrolls. While it's open, it takes Escape, so a dialog it opened over stays open.

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

A sheet rests at half height as floating glass and at full height as an opaque panel; `detents` chooses which it has. Drag its handle between them, or down to dismiss it.

### GlassGroup

```tsx
import { Button, GlassGroup } from "@onlymoein/liquidglass";

<GlassGroup spacing={20} style={{ gap: 6 }}>
  <Button aria-label="Add" icon={<PlusIcon />} />
  <Button aria-label="Edit" icon={<PencilIcon />} />
</GlassGroup>
```

Glass closer together than `spacing` becomes one shape, and parts again as it moves away.

### Popups you position yourself

Add the `lg-grow` class to a popup from a library such as Base UI or Radix, and it grows out of its `transform-origin` with the menu's spring when it has `data-open`, and shrinks away with `data-closed`.

### Tab bar

Give items an `icon` for the iOS tab bar, 62 points tall. Pass `minimized` to shrink it to the current tab's icon, as iOS does when a page scrolls down, and `onExpand` to hear when that icon is tapped.

## Transparency

Like the iOS 27 setting, `--lg-transparency` runs from `0`, fully tinted, through `0.5`, regular glass, to `1`, clear glass. The default is `0.5`. Set it anywhere, and the glass inside follows:

```css
:root {
  --lg-transparency: 0.8;
}
```

When someone has asked their system to reduce transparency or increase contrast, glass is fully tinted whatever you set, as on iOS.

## Theming

Glass follows the system's light or dark appearance. To pin one, set `data-theme="light"` or `data-theme="dark"` on any element.

Colours are CSS variables, so you can change them in your own CSS. The ones you're most likely to want:

| Variable | |
| --- | --- |
| `--lg-glass-tinted` | The tint when `--lg-transparency` is below `0.5`. |
| `--lg-contrast`, `--lg-brightness`, `--lg-saturate` | What glass 120 points tall or more does to what's behind it. Add `-small` for glass 60 or less. |
| `--lg-fill` | The accent colour of filled buttons and sliders. |
| `--lg-on` | A switch that's on. |
| `--lg-shine` | How strong the rim's lines are. `1`, the default, matches iOS 27. |

## Refraction in Safari and Firefox

Chromium bends the live backdrop, as iOS does. No other browser lets a page bend what's behind an element, so there the glass has the same colour, blur and rim but its edge doesn't bend.

In Firefox, you can put `data-liquidglass-backdrop` on what sits behind your glass, such as a wallpaper or a hero image, and the glass bends a copy of it. In Safari that attribute currently only gives you the blur and colour, because Safari can't draw the filter that does the bending.

```tsx
<img data-liquidglass-backdrop src="/wallpaper.jpg" alt="" />
```

## How close it is to iOS 27

`parity/` runs real iOS controls and this library on the same simulator, over the same backgrounds and through the same taps, and measures the difference. In short:

- **Chromium:** glass colour is within 2 levels out of 255 of iOS, in both themes and at both sizes, and its edge bends.
- **Safari:** light mode is within 2 levels. Dark mode is approximate, because its filters can't follow iOS's curve, and the edge doesn't bend.
- **Motion:** button press and menu opening are fitted to recordings of the real thing.

## Coming from glisse

The components and their props are the same. Install `@onlymoein/liquidglass` and change your imports, and rename `data-glisse-backdrop` to `data-liquidglass-backdrop`. If you restyled the glass by setting `--lg-glass`, set `--lg-glass-tinted` and `--lg-transparency` instead.

## License

MIT. Copyright Kelvin Zhang and Moein Saharkhiz.
