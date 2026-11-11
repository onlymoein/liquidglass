# Changelog

## 0.6.0

### Changed

- **Glass before Android 13 is glass, not a translucent pane.** Android 11 and earlier drew every pane as a flat, see-through fill, the tab bar's lens as a grey blob over it, and a filled button as a flat colour. Now each `Backdrop` draws a small picture of what's under its glass, once a frame and only when something in it changed, and its glass blurs it, tones it as the shader does, and lights its rim, with the hairline just outside. A filled button darkens a little over what's behind it, as on 13. On Android 12, which blurs, glass now has the tone and rim too; it was only blurred. None of it bends. The picture is a sixteenth of the size and only the part under glass: about 1.5 ms a frame while scrolling, on the emulator. A backdrop that holds a hardware bitmap, as an image from expo-image can be, is recorded and drawn on the GPU for its picture from Android 9.

### Fixed

- **Glass over a `Backdrop` that holds another one shows the outer one.** It took the inner one, so a tab bar over a page whose own glass had a `Backdrop` of the page's background showed only that background, not the page.

## 0.5.0

### Changed

Android's tab bar now moves as iOS 27's does, fitted frame by frame to recordings of the system tab bar on the iPhone simulator, with the same taps and drags on both.

- **The lens is a lens.** It was the bar's frosted glass, risen, with a white wash over it. Now it shows the bar's frost under it, enlarged, bends it at its rim and parts the colours there, with a bright ring just inside its edge, as iOS's does.
- **It's iOS's size:** about 120 by 75 points held, the bar's swell included. It was about 130 by 78. The bar swells 4.3%, as measured, not 4.9%.
- **A moving lens flattens**, down to about the bar's height when it's quick, and rounds out again more slowly once it slows. So a tap's lens never stands taller than the bar, as on iOS. Coming to a stop, it bulges a little. It used to keep its shape, only stretching slightly along a drag.
- **A tap gets there as quickly as iOS's**, two tabs in about 180 ms rather than 300. A finger-driven move has a quicker spring of its own; a selection the app changes still swings a little past, as before. The lens no longer pauses for a tenth of a second at the tab in between.
- **Let go of mid-drag, the lens stays up until it lands**, then sinks into a pill there, as iOS's does. A tapped lens sinks as it arrives. It used to drop the moment the finger lifted.

## 0.4.0

### Changed

- **Android's tab bar acts as iOS 27's does under a finger.** Its lens was a white blob with black tabs in it. Now the selected tab's pill rises into a lens of the bar's own glass, about 117 by 73 points, standing out of the bar, and the whole bar swells about 5%. Inside the lens the tabs are enlarged and in the selected colour; outside it they stay as they are. The lens follows a drag, stretching along it as it's pulled and settling back, and shrinks back into the pill on the tab it's let go over. A tap carries it across from the tab that was selected, and keeps it up for the trip. The sizes, springs and stretch are the web version's, measured on iOS.
- **The selected tab's pill on Android deepens the glass under it**, darker and richer, as iOS's does, rather than greying it. The pill also runs nearer the bar's ends, as iOS's does.
- **Android glass blurs at a quarter of its size.** A blur that wide looks the same, measured at 0.07% different on screen, for a sixteenth of the work. Only the rim's reach is drawn round each piece at full size. Dragging the tab bar went from frames of 21 to 27 ms at the 90th percentile to a steady 60 fps on the emulator's GPU.

### Added

- **`minimized` on `TabBar`**, with `onExpand`. The bar shrinks to the selected tab's icon in a glass capsule 49 by 39 points, as iOS 27 minimises a tab bar when a page scrolls down, and comes back when it's cleared. On iOS the system's bar draws into one of iOS's own glass buttons; on Android the bar's glass folds into the capsule.

### Fixed

- **Touching interactive glass on Android no longer throws "undefined is not a function".** Glass with `interactive` measured itself through a ref that doesn't have `measure`.


## 0.3.0

### Changed

- **Android's menu opens as iOS 27's does.** It was a white list that pushed the page down. Now the button melts into a drop of glass that swells into the menu, which covers the button and floats over the page, and shows the page through its glass, other glass included. It opens toward the side of the screen with more room, and folds back into the button when it closes. It opens as the finger comes down, so a finger can slide on to an item and lift there to choose it, with a capsule under the item and a tick as it moves from one to the next. A touch off the menu or the Back button closes it. Its sizes are measured from iOS: items 42 points tall, 250 points wide or more, corners of 34 points, checkmarks and icons on the leading side. The drop is drawn on the UI thread, a frame at a time, and bends a picture of the page taken when it opens, so it doesn't redraw the glass under it each frame.
- **Android controls follow the finger on the UI thread.** A switch's or slider's thumb, and the lens of a segmented control or tab bar, move in the same frame as the finger, however busy the app's JavaScript is.
- **A slider tells the app its value at most once a frame**, on iOS and Android, so a screen slow to draw doesn't fall behind the finger.
- **Android's tab bar hides its selection while its lens is up**, as iOS's does, rather than leaving a grey pill behind.
- **Buttons, steppers and menus line up in a row as iOS's do.** On Android they stayed at the top of a row their parent asked to centre, so buttons of different heights didn't line up. They still keep their own width in a column, as before.
- **Android glass that changes size compiles its shader once**, not each time it changes.


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
