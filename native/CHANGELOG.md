# Changelog

## 0.2.0

### Fixed

- **A build without the native code no longer shows grey boxes.** When the package's native code isn't in the app, because the app wasn't rebuilt or its iOS deployment target was below the package's minimum, the controls are drawn as plain stand-ins and an error says why.
- **iOS now needs only iOS 15.1**, down from 16.4, so an app on an older deployment target keeps the package.
- **The peer dependencies say what the package needs:** Expo SDK 54 or later, React Native 0.81 or later, React 19.1 or later and `expo-glass-effect` 0.1 or later. They were `*`.
- **A tab bar, switch, stepper, slider or segmented control goes back to the app's value when the app doesn't take a change.** On iOS the controls move under the finger before the app has had a say, so a tap the app ignored could leave the wrong tab selected. On Android a dragged switch or slider could stay where it was let go.
- **Controls take their place at once on iOS.** They started at 1×1 points until UIKit reported their size; now they start at the size iOS gives each control.
- **A tap on a segment's or a tab's label picks that one on Android.** It read the touch relative to the label, and picked the first.
- **A control can stop or start being controlled.** Whether the app owned the value was decided when the control first appeared.

### Added

- `setFontFamily(name)` sets the typeface for every control's labels, and `fontFamily` sets it for one `Button`, `Menu`, `SegmentedControl` or `TabBar`.
- Buttons and tabs take images of the app's own as icons, such as `require('./home.png')`, as well as SF Symbols' names.
- The tab bar's `onHeight` gives how much of the foot of the screen it takes, and `onTabLayout` where each tab is. Each tab takes a `testID` and an `accessibilityLabel`.
- In development, a warning when Android glass has no `Backdrop` behind it, and when an icon has no drawing outside iOS.
- Android glass is drawn as iOS 27's is: the rim's hairline, continuous corners, the shadow, iOS's button sizes, filled buttons as tinted glass, glass that answers a finger, and haptic ticks.

## 0.1.0

The first release: iOS's own controls and glass, and on Android the package's own glass and controls.
