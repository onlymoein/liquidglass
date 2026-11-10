import { Image, type ImageSourcePropType } from 'react-native';

import type { IconSource } from './types';

/** An icon given as an SF Symbol's name, or as an image of the app's own. */
export function iconParts(icon: IconSource | undefined): { symbol?: string; uri?: string; image?: ImageSourcePropType } {
  if (icon == null) return {};
  if (typeof icon === 'string') return { symbol: icon };
  const resolved = Image.resolveAssetSource(icon as ImageSourcePropType);
  return { uri: resolved?.uri, image: icon as ImageSourcePropType };
}

const warned = new Set<string>();

/** Says once, in development, that a symbol has no drawing here. */
export function sayNoDrawing(name: string): void {
  if (!__DEV__ || warned.has(name)) return;
  warned.add(name);
  console.warn(
    `@onlymoein/liquidglass-native: there's no drawing for the symbol "${name}" outside iOS, so ` +
      'nothing is shown there. Pass an image of your own, such as require("./home.png"), to show ' +
      'the same icon everywhere.'
  );
}
