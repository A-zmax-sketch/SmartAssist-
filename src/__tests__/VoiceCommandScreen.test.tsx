import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import VoiceCommandScreen, { ANDROID_NEEDS_READER, TYPE_ONLY_NOTE } from '@/app/voice-command';
import { AppThemeProvider } from '@/theme/ThemeContext';

import { carryOutCommand, listenForCommand } from '../../modules/screen-reader';

// The phone's voice finishes at once, so the assistant moves straight on.
jest.mock('expo-speech', () => ({
  speak: jest.fn((_text: string, options?: { onDone?: () => void }) => options?.onDone?.()),
  stop: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useCanGoBack: () => true,
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
// A pretend phone: Mum is in contacts and WhatsApp is installed.
const mockOpen = jest.fn((_link: string) => Promise.resolve(true));
jest.mock('@/services/phoneTools', () => ({
  phoneTools: {
    findContact: async () => ({ name: 'Mum', number: '+2348031234567' }),
    canOpen: async () => true,
    open: (link: string) => mockOpen(link),
    sendText: async () => 'sent',
    batteryPercent: async () => 80,
    now: () => new Date(2026, 10, 15, 9, 36),
    region: () => 'NG',
  },
}));
// Expo Go: no listening, so commands are typed.
const mockReaderOn = jest.fn(() => false);
jest.mock('../../modules/screen-reader', () => ({
  canListenInApp: false,
  listenOnce: jest.fn(),
  stopListening: jest.fn(),
  cancelListening: jest.fn(),
  listenForCommand: jest.fn(() => true),
  carryOutCommand: jest.fn(() => true),
  useScreenReaderOn: () => ({ isOn: mockReaderOn(), recheck: jest.fn() }),
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
        <VoiceCommandScreen />
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

async function typeCommand(words: string) {
  await fireEvent.changeText(screen.getByLabelText('Type a command'), words);
  await fireEvent.press(screen.getByRole('button', { name: 'Do it' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReaderOn.mockReturnValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('iPhone: a typed command is carried out and the answer is shown', async () => {
  await showScreen('ios');
  expect(screen.getByText(TYPE_ONLY_NOTE)).toBeTruthy();

  await typeCommand('how much battery do I have');

  expect(await screen.findByText('Your battery is at 80 percent.')).toBeTruthy();
  expect(screen.getByText('You said: “how much battery do I have”')).toBeTruthy();
});

test('iPhone: a message is shown with Yes and No before anything is sent', async () => {
  await showScreen('ios');

  await typeCommand('send a message to mum saying I am on my way');

  const question = 'Send: I am on my way. To Mum, on WhatsApp? Say yes or no.';
  expect(await screen.findByText(question)).toBeTruthy();
  expect(mockOpen).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Yes' }));

  expect(await screen.findByText(/Tap the Send arrow/)).toBeTruthy();
  expect(mockOpen).toHaveBeenCalledWith('whatsapp://send?phone=2348031234567&text=I%20am%20on%20my%20way');
});

test('iPhone: No sends nothing', async () => {
  await showScreen('ios');

  await typeCommand('call mum');
  await fireEvent.press(await screen.findByRole('button', { name: 'No' }));

  expect(await screen.findByText("Okay, I won't call.")).toBeTruthy();
  expect(mockOpen).not.toHaveBeenCalled();
  expect(Speech.speak).toHaveBeenCalledWith('Call Mum? Say yes or no.', expect.anything());
});

test('Android: Speak opens the screen reader’s Listening card', async () => {
  mockReaderOn.mockReturnValue(true);
  await showScreen('android');

  await fireEvent.press(screen.getByRole('button', { name: 'Speak' }));
  expect(listenForCommand).toHaveBeenCalledTimes(1);

  await typeCommand('open whatsapp');
  expect(carryOutCommand).toHaveBeenCalledWith('open whatsapp');
});

test('Android, screen reading off: explains it and offers the set-up', async () => {
  await showScreen('android');

  expect(screen.getByText(ANDROID_NEEDS_READER)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Set up screen reading' })).toBeTruthy();
});
