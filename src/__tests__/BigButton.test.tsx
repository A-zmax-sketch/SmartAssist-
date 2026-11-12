import { fireEvent, render, screen } from '@testing-library/react-native';

import { BigButton } from '@/components/BigButton';
import { AppThemeProvider } from '@/theme/ThemeContext';

// A pattern to copy for testing other components: wrap them in
// AppThemeProvider, find them the way a screen reader would, then act.
test('BigButton is announced as a button and runs onPress when tapped', async () => {
  const onPress = jest.fn();

  // In this version of Testing Library, render and fireEvent are async: always await them.
  await render(
    <AppThemeProvider>
      <BigButton label="Play" icon="play" hint="Reads your text aloud." onPress={onPress} />
    </AppThemeProvider>,
  );

  const button = await screen.findByRole('button', { name: 'Play' });
  await fireEvent.press(button);

  expect(onPress).toHaveBeenCalledTimes(1);
});
