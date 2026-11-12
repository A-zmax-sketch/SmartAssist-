import { requireOptionalNativeModule } from 'expo';
import { useCallback, useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

/**
 * SmartAssist's Android screen reader, as seen from JavaScript.
 * Owner: Kosisochukwu.
 *
 * The native code is in android/ and only exists in an Android development
 * build. In Expo Go, on iPhone and on the web the module is missing, so every
 * function here does nothing and `screenReaderAvailable` is false.
 */
type ScreenReaderNative = {
  isEnabled(): boolean;
  openSettings(): void;
  setVoice(rate: number, pitch: number): void;
  listen(): boolean;
  carryOut(words: string): boolean;
  startWakeWord(): boolean;
  stopWakeWord(): void;
  isWakeWordOn(): boolean;
  isWakeWordWanted(): boolean;
};

const native = requireOptionalNativeModule<ScreenReaderNative>('ScreenReader');

/** True on an Android build of SmartAssist that includes the screen reader. */
export const screenReaderAvailable = native != null;

/** True if the user has switched SmartAssist on in Settings > Accessibility. */
export function isScreenReaderOn(): boolean {
  return native?.isEnabled() ?? false;
}

/** Opens the phone's Accessibility settings. */
export function openScreenReaderSettings(): void {
  native?.openSettings();
}

/** Makes the screen reader use the same speed and pitch as the app. */
export function setScreenReaderVoice(rate: number, pitch: number): void {
  native?.setVoice(rate, pitch);
}

/**
 * Opens the "Listening…" card and carries out the voice command the user says
 * ("open WhatsApp", "call Mum"…). Returns false if screen reading is off or
 * this isn't an Android build with the screen reader.
 */
export function listenForCommand(): boolean {
  return native?.listen() ?? false;
}

/** Carries out typed words as a voice command. For testing without a microphone. */
export function carryOutCommand(words: string): boolean {
  return native?.carryOut(words) ?? false;
}

// ---- "Hey SmartAssist" --------------------------------------------------

/**
 * Starts listening for "Hey SmartAssist". Asks for the microphone (and, on
 * Android 13+, notifications) first. Must be called while SmartAssist is
 * on screen. Returns false if it couldn't start.
 */
export async function turnOnHeySmartAssist(): Promise<boolean> {
  if (!native || Platform.OS !== 'android') return false;
  const mic = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (mic !== PermissionsAndroid.RESULTS.GRANTED) return false;
  if (Number(Platform.Version) >= 33) {
    // Without it Android hides the "listening" notification; listening still works.
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  return native.startWakeWord();
}

export function turnOffHeySmartAssist(): void {
  native?.stopWakeWord();
}

export function isHeySmartAssistOn(): boolean {
  return native?.isWakeWordOn() ?? false;
}

/**
 * Android won't start "Hey SmartAssist" by itself after the phone restarts,
 * so the app turns it back on when it is opened, if the user had it on.
 */
export function resumeHeySmartAssist(): void {
  if (native?.isWakeWordWanted() && !native.isWakeWordOn()) {
    native.startWakeWord();
  }
}

/** Whether "Hey SmartAssist" is listening, with buttons' actions to change it. */
export function useHeySmartAssist() {
  const [isOn, setIsOn] = useState(isHeySmartAssistOn);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') setIsOn(isHeySmartAssistOn());
    });
    return () => subscription.remove();
  }, []);

  const turnOn = useCallback(async () => {
    const started = await turnOnHeySmartAssist();
    setIsOn(started);
    return started;
  }, []);

  const turnOff = useCallback(() => {
    turnOffHeySmartAssist();
    setIsOn(false);
  }, []);

  return { isOn, turnOn, turnOff };
}

/**
 * Whether screen reading is on, checked again every time the user comes
 * back to SmartAssist (for example from the phone's Settings).
 * `recheck` checks again on demand, e.g. when a screen comes into view.
 */
export function useScreenReaderOn(): { isOn: boolean; recheck: () => void } {
  const [isOn, setIsOn] = useState(isScreenReaderOn);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        setIsOn(isScreenReaderOn());
      }
    });
    return () => subscription.remove();
  }, []);

  const recheck = useCallback(() => setIsOn(isScreenReaderOn()), []);
  return { isOn, recheck };
}
