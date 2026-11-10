import type { ColorValue } from 'react-native';

// SF Symbols can only be drawn on Apple's platforms, and iOS draws them in its own controls, so
// the stand-ins elsewhere have no icons yet.
export const hasIcon = (_name: string | undefined): _name is string => false;

export function Icon(_props: { name: string; color: ColorValue; size?: number; weight?: number }) {
  return null;
}

export const bottomInset = (): number => 0;
