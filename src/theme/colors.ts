/**
 * Colour tokens from the plan's Design system section.
 *
 * Every screen must take its colours from here (through useAppTheme),
 * never hard-code a hex value, so High-contrast mode works everywhere.
 * The tests in src/__tests__/contrast.test.ts check each text/background
 * pair meets WCAG AA (at least 4.5:1).
 */

export type ColorTokens = {
  /** Screen background */
  background: string;
  /** Tiles, cards, text boxes */
  surface: string;
  /** Main text */
  text: string;
  /** Hints and secondary text */
  textMuted: string;
  /** Outlines of tiles, cards and text boxes */
  border: string;
  /** Main buttons, mic button, focus ring */
  primary: string;
  /** Text and icons placed on primary */
  onPrimary: string;
  /** Stop, Delete, errors */
  danger: string;
  onDanger: string;
  /** "Done" and "Saved" states */
  success: string;
  onSuccess: string;
};

export const defaultColors: ColorTokens = {
  background: '#FFFFFF',
  surface: '#F2F4F7',
  text: '#111111',
  textMuted: '#4A4A4A',
  border: '#4A4A4A',
  primary: '#0B57D0',
  onPrimary: '#FFFFFF',
  danger: '#B3261E',
  onDanger: '#FFFFFF',
  success: '#1E7A34',
  onSuccess: '#FFFFFF',
};

export const highContrastColors: ColorTokens = {
  background: '#000000',
  surface: '#1A1A1A',
  text: '#FFFFFF',
  textMuted: '#E0E0E0',
  border: '#FFFFFF',
  primary: '#FFD600',
  onPrimary: '#000000',
  danger: '#FF6B6B',
  onDanger: '#000000',
  success: '#5BE37D',
  onSuccess: '#000000',
};
