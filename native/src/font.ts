let family: string | undefined;

/**
 * Sets the typeface for every control's labels: buttons, menus, segments and tabs. Call it once
 * when the app starts, with the name the font was loaded under, such as `"Poppins"` or
 * `"Poppins-Medium"`. A control's own `fontFamily` wins. Left unset, iOS uses San Francisco and
 * Android the package's Inter.
 */
export function setFontFamily(name: string | undefined): void {
  family = name || undefined;
}

export const fontFamilyFor = (own: string | undefined): string | undefined => own ?? family;
