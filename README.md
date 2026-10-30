# liquidglass

Apple's iOS 27 Liquid Glass for React: glass that bends the light behind it, with controls that move like the real ones.

It started as a fork of [glisse](https://github.com/0kzh/glisse) by Kelvin Zhang and adds the iOS 27 refinements: a darker edge, brighter highlights, more diffusion, a clear-to-tinted transparency setting and the uniform toolbar.

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
| `Button` | A glass or filled button, with an optional icon, tint or destructive style. |
| `Toolbar`, `ToolbarGroup` | A bar of actions that frosts as content scrolls under it. |
| `TabBar` | Tabs with a lens that follows your finger between them. |
| `Switch` | An on/off switch with a glass thumb. |
| `Slider` | A slider with a glass thumb. |
| `Input`, `SearchField` | Text fields set in glass. |
| `Menu` | A menu that grows out of its trigger. |

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

With a `label`, the trigger is a pill with a chevron, like an iOS pull-down button, and the pill itself stretches into the menu. Without one, it's a round button with an ellipsis or your `icon`.

## Transparency

Like the iOS 27 setting, `--lg-transparency` runs from `0`, fully tinted, to `1`, fully clear. The default is `0.5`. Set it anywhere, and the glass inside follows:

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
| `--lg-glass-clear`, `--lg-glass-tinted` | The glass at each end of the transparency range. |
| `--lg-fill` | The accent colour of filled buttons and sliders. |
| `--lg-on` | A switch that's on. |
| `--lg-shine` | How bright the rim highlight is. `1` is the iOS 26 rim; the default is `1.4`. |

## Refraction in Safari and Firefox

Chromium bends the live backdrop. Safari and Firefox can't filter it, so the glass bends a copy of content you mark instead. Put `data-liquidglass-backdrop` on what sits behind your glass, such as a wallpaper or a hero image:

```tsx
<img data-liquidglass-backdrop src="/wallpaper.jpg" alt="" />
```

Without it, those browsers keep the blur and the rim highlight but don't bend.

## Coming from glisse

The components and their props are the same. Install `@onlymoein/liquidglass` and change your imports, and rename `data-glisse-backdrop` to `data-liquidglass-backdrop`. If you restyled the glass by setting `--lg-glass`, set `--lg-glass-clear` and `--lg-glass-tinted` instead.

## License

MIT. Copyright Kelvin Zhang and Moein Saharkhiz.
