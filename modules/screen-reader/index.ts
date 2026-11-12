import { requireOptionalNativeModule } from 'expo';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

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
