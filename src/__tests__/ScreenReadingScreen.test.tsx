import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ScreenReadingScreen from '@/app/screen-reading';
import { ANDROID_HOW_TO_USE, ANDROID_STEPS, HEY_SMARTASSIST_FAILED, IPHONE_STEPS } from '@/services/screenReadingGuide';
import { AppThemeProvider } from '@/theme/ThemeContext';

import { openScreenReaderSettings } from '../../modules/screen-reader';

// Pretend versions of the phone's voice, navigation and the Android screen reader.
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useCanGoBack: () => true,
  useFocusEffect: jest.fn(),
}));
const mockIsOn = jest.fn(() => false);
const mockTurnOnHey = jest.fn(() => Promise.resolve(true));
jest.mock('../../modules/screen-reader', () => ({
  screenReaderAvailable: true,
  isScreenReaderOn: () => mockIsOn(),
  useScreenReaderOn: () => ({ isOn: mockIsOn(), recheck: jest.fn() }),
  useHeySmartAssist: () => ({ isOn: false, turnOn: mockTurnOnHey, turnOff: jest.fn() }),
  openScreenReaderSettings: jest.fn(),
  setScreenReaderVoice: jest.fn(),
}));

const PHONE = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function showScreen(platform: 'ios' | 'android') {
  jest.replaceProperty(Platform, 'OS', platform);
  await render(
    <SafeAreaProvider initialMetrics={PHONE}>
      <AppThemeProvider>
        <ScreenReadingScreen />
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

const lastSpoken = () => {
  const calls = (Speech.speak as jest.Mock).mock.calls;
  return calls[calls.length - 1]?.[0];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOn.mockReturnValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('iPhone: guides the user through Speak Screen one step at a time, out loud', async () => {
  await showScreen('ios');

  expect(screen.getByText(`Step 1 of ${IPHONE_STEPS.length}`)).toBeTruthy();
  expect(screen.getByText(IPHONE_STEPS[0])).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Open Settings' })).toBeNull(); // iPhone apps can't open it

  await fireEvent.press(screen.getByRole('button', { name: 'Next step' }));

  expect(screen.getByText(IPHONE_STEPS[1])).toBeTruthy();
  expect(lastSpoken()).toBe(IPHONE_STEPS[1]);
});

test('Android, switched off: Open Settings takes the user to Accessibility settings', async () => {
  await showScreen('android');

  expect(screen.getByText(ANDROID_STEPS[0])).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));

  expect(openScreenReaderSettings).toHaveBeenCalledTimes(1);
});

test('Android, switched on: explains how to use it instead of the steps', async () => {
  mockIsOn.mockReturnValue(true);
  await showScreen('android');

  expect(screen.getByText(ANDROID_HOW_TO_USE)).toBeTruthy();
  expect(screen.queryByText(/Step 1 of/)).toBeNull();
});

test('Android, switched on: "Hey SmartAssist" can be turned on, and failure is explained', async () => {
  mockIsOn.mockReturnValue(true);
  await showScreen('android');

  await fireEvent.press(screen.getByRole('button', { name: 'Turn on “Hey SmartAssist”' }));
  expect(mockTurnOnHey).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(HEY_SMARTASSIST_FAILED)).toBeNull();

  mockTurnOnHey.mockResolvedValueOnce(false); // e.g. microphone not allowed
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on “Hey SmartAssist”' }));
  expect(await screen.findByText(HEY_SMARTASSIST_FAILED)).toBeTruthy();
});
