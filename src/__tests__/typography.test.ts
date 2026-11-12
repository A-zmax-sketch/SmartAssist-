import { TEXT_SIZE_LEVELS, TEXT_SIZES } from '@/theme/typography';

test('Normal body text is 20pt, as in the design system', () => {
  expect(TEXT_SIZES.normal.body).toBe(20);
});

test('every text size level is bigger than the one before it', () => {
  for (let i = 1; i < TEXT_SIZE_LEVELS.length; i++) {
    const smaller = TEXT_SIZES[TEXT_SIZE_LEVELS[i - 1]];
    const bigger = TEXT_SIZES[TEXT_SIZE_LEVELS[i]];
    expect(bigger.body).toBeGreaterThan(smaller.body);
    expect(bigger.button).toBeGreaterThan(smaller.button);
    expect(bigger.title).toBeGreaterThan(smaller.title);
  }
});
