import type { TextSizeLevel } from '@/theme/typography';

/**
 * Everything the user can change in Settings, plus whether they have
 * seen the Welcome screen.
 */
export type Settings = {
  textSize: TextSizeLevel;
  highContrast: boolean;
  /** Say each button's name aloud when it is tapped. */
  speakButtons: boolean;
  /** Speech speed: 1 is normal, 0.5 is half speed, 2 is double. */
  voiceRate: number;
  /** Voice pitch: 1 is normal. */
  voicePitch: number;
  hasSeenWelcome: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  textSize: 'normal',
  highContrast: false,
  speakButtons: false,
  voiceRate: 1,
  voicePitch: 1,
  hasSeenWelcome: false,
};

/*
 * PHASE 2 TASK (backend/testing member 1):
 * Settings only live in memory for now, so they reset every time the app
 * restarts. Replace the two functions below so they save to and load from
 * the phone with @react-native-async-storage/async-storage. Keep the same
 * function names and types; nothing else in the app needs to change.
 */

let inMemory: Settings = DEFAULT_SETTINGS;

export async function loadSettings(): Promise<Settings> {
  return inMemory;
}

export async function saveSettings(settings: Settings): Promise<void> {
  inMemory = settings;
}
