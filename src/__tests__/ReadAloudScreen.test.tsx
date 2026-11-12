import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ReadAloudScreen from '@/app/read-aloud';
import { AppThemeProvider } from '@/theme/ThemeContext';

// Pretend versions of the parts that need a real phone or real navigation.
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(() => Promise.resolve('Copied words.')),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useCanGoBack: () => true,
  useFocusEffect: jest.fn(),
}));

const speakMock = Speech.speak as jest.Mock;
const spoken = () => speakMock.mock.calls.map((call) => call[0]);

// The app's screens expect to know the phone's notch and edges; give them a plain phone.
const PHONE = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function showScreen() {
  await render(
    <SafeAreaProvider initialMetrics={PHONE}>
      <AppThemeProvider>
        <ReadAloudScreen />
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  speakMock.mockClear();
});

test('Play is greyed out until there is some text', async () => {
  await showScreen();

  const play = await screen.findByRole('button', { name: 'Play' });
  expect(play).toBeDisabled();
});

test('Play reads the text, Pause stops, and Play carries on from the same sentence', async () => {
  await showScreen();

  await fireEvent.changeText(screen.getByLabelText('Text to read aloud'), 'First sentence. Second sentence.');
  await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
  expect(spoken()).toEqual(['First sentence.']);

  // Pause during the first sentence.
  await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
  speakMock.mock.calls[0][1].onDone(); // the phone reports "done" late: must not move on after Pause
  expect(spoken()).toEqual(['First sentence.']);

  await fireEvent.press(await screen.findByRole('button', { name: 'Play from where I stopped' }));
  expect(spoken()).toEqual(['First sentence.', 'First sentence.']);
});

test('Paste puts the copied text in the box', async () => {
  await showScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Paste' }));

  expect(await screen.findByDisplayValue('Copied words.')).toBeTruthy();
});
