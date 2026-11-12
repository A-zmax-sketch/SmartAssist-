/**
 * Text sizes and font from the plan's Design system section.
 *
 * The user picks one of four text-size levels in Settings. Every screen
 * must still work (wrap, scroll, never cut text off) at the largest level.
 */

export type TextSizeLevel = 'normal' | 'large' | 'extraLarge' | 'huge';

/** Smallest to largest. "Bigger text" / "Smaller text" step through this list. */
export const TEXT_SIZE_LEVELS: TextSizeLevel[] = ['normal', 'large', 'extraLarge', 'huge'];

/** What each level is called on screen and when spoken. */
export const TEXT_SIZE_LABELS: Record<TextSizeLevel, string> = {
  normal: 'Normal',
  large: 'Large',
  extraLarge: 'Extra large',
  huge: 'Huge',
};

export type TextSizes = {
  /** Body text, in points */
  body: number;
  /** Button labels */
  button: number;
  /** Screen titles */
  title: number;
};

export const TEXT_SIZES: Record<TextSizeLevel, TextSizes> = {
  normal: { body: 20, button: 22, title: 28 },
  large: { body: 24, button: 26, title: 34 },
  extraLarge: { body: 30, button: 32, title: 40 },
  huge: { body: 36, button: 38, title: 48 },
};

/** Line height as a multiple of the font size. */
export const LINE_HEIGHT = 1.4;

/**
 * Atkinson Hyperlegible, a free font designed for low-vision readers.
 * These names must match the keys passed to useFonts in src/app/_layout.tsx.
 */
export const FONTS = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
};
