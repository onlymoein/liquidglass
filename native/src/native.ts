import { requireOptionalNativeModule } from 'expo';

/**
 * Whether the package's native code is in this build. It isn't when the app was built before the
 * package was added, or, on iOS, when the app targets a version below the package's minimum and
 * CocoaPods leaves it out. Then React Native would draw each control as a grey "Unimplemented
 * component" box, so the package draws plain stand-ins instead and says why, once.
 */
export const native = requireOptionalNativeModule<{
  hasIcon?(name: string): boolean;
  bottomInset?(): number;
  haptic?(kind: string): void;
}>('LiquidGlass');

let told = false;

export function sayMissing(): void {
  if (told || native) return;
  told = true;
  console.error(
    "@onlymoein/liquidglass-native: the package's native code isn't in this build, so plain " +
      'stand-ins are drawn instead of its controls and glass. Rebuild the app after installing ' +
      'the package (npx expo run:ios, npx expo run:android, or a new development build). On iOS ' +
      "the app's deployment target has to be iOS 15.1 or later, or CocoaPods leaves the package out."
  );
}
