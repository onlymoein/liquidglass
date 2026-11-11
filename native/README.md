# liquidglass for React Native

Apple's iOS 27 Liquid Glass for React Native and Expo, with the same component names as [liquidglass for the web](https://github.com/onlymoein/liquidglass).

On iOS 26 and later the components are UIKit's own controls and glass, so iOS draws them itself. The glass bends what's behind it, the controls swell when pressed, and a held tab bar shows Apple's lens. It all matches Apple's apps because it is Apple's.

<table>
  <tr>
    <td align="center" width="50%"><img src="https://raw.githubusercontent.com/onlymoein/liquidglass/main/native/assets/ios-light.png" width="300" alt="The example app on iOS 27 in light mode: glass cards with a switch, stepper and slider, a segmented control, glass buttons and a floating glass tab bar over coloured circles."></td>
    <td align="center" width="50%"><img src="https://raw.githubusercontent.com/onlymoein/liquidglass/main/native/assets/ios-dark.png" width="300" alt="The same screen in dark mode."></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="https://raw.githubusercontent.com/onlymoein/liquidglass/main/native/assets/tab-lens.png" width="600" alt="A finger held on the tab bar: iOS's lens magnifies the Glass and Saved tabs and splits their colours at its rim."><br>Holding the tab bar, on iOS 27.</td>
  </tr>
</table>

## Install

In an Expo app:

```sh
npx expo install @onlymoein/liquidglass-native expo-glass-effect
npx expo run:ios
```

It needs Expo SDK 54 or later (React Native 0.81 or later), and on iOS a deployment target of iOS 15.1 or later. It's built and tested against SDK 58. The glass and glass controls are iOS 26's; earlier iOS versions get UIKit's ordinary controls.

The package includes native code, so it needs a development build (`npx expo run:ios`, or EAS Build). It doesn't run in Expo Go. In a bare React Native app, install [Expo Modules](https://docs.expo.dev/bare/installing-expo-modules/) first.

If the native code isn't in the build, because the app wasn't rebuilt after installing or its iOS deployment target is too low, the package draws plain stand-ins instead of grey "Unimplemented component" boxes, and logs an error saying why.

## Use

```tsx
import { Button, Glass, Slider, Switch, TabBar } from '@onlymoein/liquidglass-native';
import { useState } from 'react';
import { View } from 'react-native';

export function Player() {
  const [tab, setTab] = useState('home');
  const [volume, setVolume] = useState(0.5);
  return (
    <>
      <Glass style={{ padding: 16, borderRadius: 28, gap: 12 }}>
        <Switch defaultChecked onCheckedChange={(on) => console.log(on)} />
        <Slider value={volume} onValueChange={setVolume} />
        <Button label="Done" variant="filled" onPress={() => console.log('done')} />
      </Glass>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <TabBar
          items={[
            { value: 'home', label: 'Home', icon: 'house', selectedIcon: 'house.fill' },
            { value: 'search', label: 'Search', icon: 'magnifyingglass' },
          ]}
          value={tab}
          onValueChange={setTab}
        />
      </View>
    </>
  );
}
```

Icons are [SF Symbols](https://developer.apple.com/sf-symbols/) names, such as `"house.fill"`, or images of your own, such as `require('./home.png')`, for buttons and tabs. An image is drawn in the control's colour, as a symbol is, so give it a transparent background.

Controls size themselves the way UIKit sizes them, starting from the size iOS gives each kind so nothing jumps into place. A slider, segmented control or tab bar fills the width it's given.

Each control works controlled or uncontrolled. When the app controls the value and doesn't take a change, such as a tap it ignores, the control goes back to the app's value.

### Fonts

Labels are San Francisco on iOS. To use your app's typeface for every control's labels, set it once when the app starts, with the name the font was loaded under:

```tsx
import { setFontFamily } from '@onlymoein/liquidglass-native';

setFontFamily('Poppins');
```

`fontFamily` on a `Button`, `Menu`, `SegmentedControl` or `TabBar` sets it for that one control.

### The tab bar

Put the tab bar at the very bottom of the screen, as above. It leaves room for the home indicator itself.

- `onHeight` gives how much of the foot of the screen the bar takes, down to the screen's edge: leave that much room under content, and float buttons that far up.
- `onTabLayout` gives where each tab is on the screen, for pointing one out, as an intro tour does.
- Each item takes a `testID`, for finding that tab in tests, and an `accessibilityLabel`.
- `minimized` shrinks the bar to the selected tab's icon in a small glass capsule, as iOS 27 does when a page scrolls down. Set it as the page scrolls down and clear it as it scrolls back up; `onExpand` is called when the capsule is tapped. A search tab is an ordinary item: iOS 27 keeps it in the bar with the others.

```tsx
const [minimized, setMinimized] = useState(false);
const lastY = useRef(0);

<ScrollView
  scrollEventThrottle={16}
  onScroll={(event) => {
    const y = event.nativeEvent.contentOffset.y;
    if (Math.abs(y - lastY.current) > 8) {
      setMinimized(y > lastY.current && y > 40);
      lastY.current = y;
    }
  }}
/>
<TabBar items={tabs} minimized={minimized} onExpand={() => setMinimized(false)} />
```

## Components

| Component | What it is on iOS |
| --- | --- |
| `Glass` | A pane of glass, `regular` or `clear`, optionally `tint`ed or `interactive` |
| `GlassGroup` | Glass inside it flows together when shapes come within `spacing` |
| `Backdrop` | What glass shows on Android; a plain view on iOS and the web. See [Android](#android) |
| `Button` | A glass button, or `variant="filled"` for the primary action; `small`, `regular` or `large` |
| `Menu` | A button that opens iOS's glass menu, with icons, checkmarks and destructive items |
| `Switch` | `UISwitch` |
| `Slider` | `UISlider`, with `step` |
| `Stepper` | `UIStepper` |
| `SegmentedControl` | `UISegmentedControl` |
| `TabBar` | The floating tab bar, with its lens, badges and selected icons |
| `Text` | React Native's `Text` on iOS; on Android, set in a typeface close to San Francisco. See [Android](#android) |
| `ScrollView` | React Native's `ScrollView` on iOS; on Android, its ends bounce as iOS's do |

Each control works controlled (`value` / `checked`) or uncontrolled (`defaultValue` / `defaultChecked`), as React's inputs do.

## Android

Android has no Liquid Glass of its own, so the package draws it. Glass shows what's behind it bent at the rim, blurred, lifted and saturated, following the same optics as the web version, and is drawn with what iOS draws round it, measured against the iPhone simulator: a lit line along the top and bottom, a dark hairline just outside the sides, iOS's continuous corners, and a soft shadow that grows with the glass. Tilt the phone and the light stays where it is in the room, so the hairline slides round the rim toward the corners. It listens to gravity only while glass is on screen and the app is in front, and not at all when the system's animations are turned off.

<img src="https://raw.githubusercontent.com/onlymoein/liquidglass/main/native/assets/android-vs-ios.png" width="900" alt="The example app side by side: iOS 27's own glass on the left, then this package's glass on Android in light and dark mode.">

An Android view can't see what's drawn behind it, so glass there shows what's inside a `Backdrop`. Wrap what the glass should show, and keep the glass itself outside it:

```tsx
<Backdrop style={{ flex: 1 }}>
  <ScrollView>{/* the page */}</ScrollView>
</Backdrop>
<TabBar items={tabs} />{/* shows the page, as it's outside the Backdrop */}
```

Glass uses the nearest `Backdrop` drawn before it, as a sibling of the glass or of one of its parents. Give the backdrop a background colour, which is what glass shows where nothing is drawn. On iOS and the web a `Backdrop` is a plain view, so the same code works everywhere. Glass on Android that finds no `Backdrop` behind it draws a plain pane, and in development says so in a warning.

A `Menu` on Android opens over the whole screen, on a layer the outermost `Backdrop` adds just after itself, and its glass shows everything that Backdrop holds, other glass included. So put the outermost `Backdrop` round the whole screen, as above. With no `Backdrop` at all, a menu opens in a window of its own.

- **Android 13 and later:** the full glass.
- **Android 12 and earlier:** the glass blurred, toned and lit at its rim as on 13, without the bend. Before 12 Android can't blur as it draws, so each `Backdrop` draws a small picture of what's under its glass once a frame, which its glass blurs and shares. A backdrop holding a hardware bitmap, as an image Glide loads can be, is drawn on the GPU for that from Android 9; before 9, glass on it is a translucent pane.

Glass shows the outermost `Backdrop` that covers it, of those drawn before it: a `Backdrop` inside another, for the page's own glass, doesn't hide the rest of the page from a tab bar over both.

Buttons are iOS 27's sizes, and a filled button is tinted glass that darkens a little over what's behind it, as iOS's does. Under a finger, glass grows, follows the finger and stretches toward it, lights its rim and glows where it's touched, then springs back, and the switch, slider, stepper, segmented control and tab bar tick with Android's own haptic effects.

The tab bar and buttons on Android are laid out as iOS lays them out, on the glass: each tab's icon above its label, the selected tab on a pill that deepens the glass under it, badges, and the bar above the gesture handle. Holding the tab bar works as iOS 27's does, to its measurements: the bar swells a little, the pill rises into a lens about 117 by 73 points that stands out of the bar, and inside it the tabs are enlarged and in the selected colour. The lens follows a drag, stretching along it, and shrinks back into the pill on the tab it's let go over. A quick tap keeps it up for the trip across.

Apple only allows SF Symbols on its own platforms, so Android gets the package's own icons, drawn for it, under the same names. A name without a drawing shows nothing and warns in development; pass an image of your own to show the same icon everywhere. The drawings: `house`, `magnifyingglass`, `gearshape`, `bookmark`, `heart`, `star`, `person`, `bell`, `trash`, `calendar`, `square.and.arrow.up`, `slider.horizontal.3`, `circle.hexagongrid`, `ellipsis`, `plus`, `minus`, `xmark`, `checkmark`, the chevrons, and more. Most have a `.fill` version. A name without a drawing shows no icon, and an icon-only button then shows its `accessibilityLabel`'s first letter.

The switch, slider, stepper and segmented control on Android follow iOS 27's sizes, colours and springs. Under a finger, a switch or slider thumb swells into a clear lens over its track, and the segmented control's lens slides across the labels. Glass directly inside a `GlassGroup` is drawn as one surface, so pieces closer than `spacing` flow together and part again as they move apart. Tinted glass in a group draws on its own.

Apple's San Francisco typeface is only for Apple's systems, so on Android the package's `Text` sets text in [Inter](https://rsms.me/inter/), an open typeface close to it, which the package carries (under the SIL Open Font License). It switches to Inter Display at 20 points, as iOS switches to SF Display, and is sized and spaced so a line runs as long as it does on an iPhone. Use it in place of React Native's `Text`; a `fontFamily` of your own wins. The package's controls use it already.

The package's `ScrollView` makes the ends bounce on Android as they do on iOS, in place of Android's stretch: dragged past an end, the page follows the finger less and less and springs back, and a fling carries past the end and springs back. Horizontal scroll views, and ones with a `refreshControl`, are React Native's own.

## Other platforms

- **iOS 25 and earlier:** the controls are the system's ordinary ones, and `Glass` is a translucent pane.
- **Web:** plain stand-ins for now. For a web app, use [liquidglass for the web](https://github.com/onlymoein/liquidglass).

## Example app

```sh
cd native && npm install && npm run build
cd example && npm install && npx expo run:ios   # or run:android
```

## License

MIT
