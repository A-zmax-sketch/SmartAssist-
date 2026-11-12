import { defaultColors, highContrastColors, type ColorTokens } from '@/theme/colors';
import { contrastRatio } from '@/theme/contrast';

// WCAG AA: normal text needs 4.5:1, outlines and icons need 3:1.
const TEXT_PAIRS: [keyof ColorTokens, keyof ColorTokens][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['onPrimary', 'primary'],
  ['onDanger', 'danger'],
  ['onSuccess', 'success'],
];

const OUTLINE_PAIRS: [keyof ColorTokens, keyof ColorTokens][] = [
  ['border', 'background'],
  ['border', 'surface'],
  ['primary', 'background'],
  ['primary', 'surface'],
];

describe.each([
  ['Default', defaultColors],
  ['High contrast', highContrastColors],
])('%s theme', (_name, colors) => {
  test.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  test.each(OUTLINE_PAIRS)('%s on %s is at least 3:1', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(3);
  });
});

test('contrastRatio gives 21 for black on white', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
});
