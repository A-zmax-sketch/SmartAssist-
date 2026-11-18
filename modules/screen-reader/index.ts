import { type EventSubscription, NativeModule, requireOptionalNativeModule } from 'expo';
import { useCallback, useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

/**
 * SmartAssist's screen reading and voice commands, as seen from JavaScript.
 * Owner: Kosisochukwu.
 *
 * Android (android/): SmartAssist's own screen reader, the floating button,
 * voice commands and "Hey SmartAssist".
 * iPhone (ios/): Apple doesn't let apps read other apps, so it reports whether
 * Apple's Speak Screen is on, hears voice commands inside SmartAssist, and
 * passes on "Hey Siri, talk to SmartAssist" (app-intents/).
 *
 * The native code only exists in a development build. In Expo Go and on the
 * web the module is missing, so every function here does nothing.
 */
type AndroidNative = {
  isEnabled(): boolean;
  openSettings(): void;
  setVoice(rate: number, pitch: number): void;
  listen(): boolean;
  carryOut(words: string): boolean;
  hearOnce(prompt: string): Promise<{ kind: 'heard'; text: string } | { kind: 'nothing' | 'cancelled' | 'denied' }>;
  startWakeWord(): boolean;
  stopWakeWord(): void;
  isWakeWordOn(): boolean;
  isWakeWordWanted(): boolean;
};

/** What the iPhone module sends while it listens. */
export type SpeechEvent =
  | { type: 'partial'; text: string }
  | { type: 'end'; text: string }
  | { type: 'error'; code: 'permission' | 'unavailable' | 'audio' };

type IphoneEvents = {
  onSpeech(event: SpeechEvent): void;
  onLaunchAction(): void;
};

declare class IphoneNative extends NativeModule<IphoneEvents> {
  isSpeakScreenOn(): Promise<boolean>;
  requestSpeechPermission(): Promise<'granted' | 'denied' | 'restricted'>;
  startListening(options: { contextualStrings: string[]; shortAnswer: boolean }): Promise<boolean>;
  stopListening(): Promise<void>;
  cancelListening(): Promise<void>;
  takeLaunchAction(): string | null;
}

const nativeModule = requireOptionalNativeModule('ScreenReader');
const native = Platform.OS === 'android' ? (nativeModule as AndroidNative | null) : null;
const iphone = Platform.OS === 'ios' ? (nativeModule as IphoneNative | null) : null;

/** True on an Android build of SmartAssist that includes the screen reader. */
export const screenReaderAvailable = native != null;

/** True if the user has switched SmartAssist on in Settings > Accessibility (Android). */
export function isScreenReaderOn(): boolean {
  return native?.isEnabled() ?? false;
}

/** True if Settings > Accessibility > Spoken Content > Speak Screen is on (iPhone). */
export async function isSpeakScreenOn(): Promise<boolean> {
  return (await iphone?.isSpeakScreenOn().catch(() => false)) ?? false;
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
 * Whether screen reading is on: SmartAssist's reader on Android, Apple's
 * Speak Screen on iPhone. Checked again every time the user comes back to
 * SmartAssist (for example from the phone's Settings).
 * `recheck` checks again on demand, e.g. when a screen comes into view.
 */
export function useScreenReaderOn(): { isOn: boolean; recheck: () => void } {
  const [isOn, setIsOn] = useState(isScreenReaderOn);

  const recheck = useCallback(() => {
    if (iphone) {
      void isSpeakScreenOn().then(setIsOn);
    } else {
      setIsOn(isScreenReaderOn());
    }
  }, []);

  useEffect(() => {
    recheck();
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') recheck();
    });
    return () => subscription.remove();
  }, [recheck]);

  return { isOn, recheck };
}

// ---- Listening inside the app ------------------------------------------

/**
 * True if this build can hear voice commands inside SmartAssist: an iPhone
 * or Android development build. (Not Expo Go or the web: commands are typed there.)
 */
export const canListenInApp = iphone != null || native != null;

export type ListenResult =
  | { kind: 'heard'; text: string }
  /** Listened, but nobody spoke. */
  | { kind: 'nothing' }
  /** The microphone or speech recognition isn't allowed. */
  | { kind: 'denied' }
  /** Can't listen here (Expo Go, no internet for the recogniser, no microphone). */
  | { kind: 'unavailable' }
  /** cancelListening() was called. */
  | { kind: 'cancelled' };

type ListenOptions = {
  /** Words the user is likely to say, like app names, so they are heard right. */
  contextualStrings?: string[];
  /** Waiting for a short answer like "yes": stops sooner after the user speaks. */
  shortAnswer?: boolean;
  /** Called with the words so far, while the user is talking (iPhone; Android shows them on its card). */
  onWords?: (text: string) => void;
  /** Android: the big line on the Listening card. */
  prompt?: string;
};

let endListening: ((result: ListenResult) => void) | null = null;

/**
 * Listens for one thing the user says and resolves with the words. Asks for
 * the microphone and speech recognition the first time. Stops by itself
 * when the user stops talking.
 */
export async function listenOnce({ contextualStrings = [], shortAnswer = false, onWords, prompt = '' }: ListenOptions = {}): Promise<ListenResult> {
  if (native) {
    // Android: only a window on screen may use the microphone, so its Listening card hears it.
    return native.hearOnce(prompt).catch((): ListenResult => ({ kind: 'unavailable' }));
  }
  if (!iphone) return { kind: 'unavailable' };
  const permission = await iphone.requestSpeechPermission().catch(() => 'denied');
  if (permission !== 'granted') return { kind: 'denied' };

  endListening?.({ kind: 'cancelled' });
  return new Promise<ListenResult>((resolve) => {
    let subscription: EventSubscription | null = null;
    const end = (result: ListenResult) => {
      subscription?.remove();
      if (endListening === end) endListening = null;
      resolve(result);
    };
    endListening = end;
    subscription = iphone.addListener('onSpeech', (event) => {
      if (event.type === 'partial') {
        onWords?.(event.text);
      } else if (event.type === 'end') {
        end(event.text.trim() ? { kind: 'heard', text: event.text } : { kind: 'nothing' });
      } else {
        end(event.code === 'permission' ? { kind: 'denied' } : { kind: 'unavailable' });
      }
    });
    // If it can't start, an error event has already ended it.
    iphone.startListening({ contextualStrings, shortAnswer }).catch(() => end({ kind: 'unavailable' }));
  });
}

/**
 * Asks for the microphone (and, on iPhone, speech recognition), for the
 * Welcome screen's "Allow microphone" button. 'unavailable' in Expo Go and
 * on the web, where SmartAssist can't listen anyway.
 */
export async function askForMicrophone(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (iphone) {
    const answer = await iphone.requestSpeechPermission().catch(() => 'denied');
    return answer === 'granted' ? 'granted' : 'denied';
  }
  if (native && Platform.OS === 'android') {
    const answer = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO).catch(() => 'denied');
    return answer === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
  }
  return 'unavailable';
}

/** Stops listening now and keeps what was heard so far ("I've finished talking"). */
export function stopListening(): void {
  void iphone?.stopListening();
}

/** Stops listening and throws away what was heard. */
export function cancelListening(): void {
  void iphone?.cancelListening();
  endListening?.({ kind: 'cancelled' });
}

// ---- Siri, the Action Button and Shortcuts (iPhone) --------------------

/** What "Hey Siri, … SmartAssist" asked for. */
export type LaunchAction = 'listen' | 'readAloud' | 'readCopied';

/** The action Siri or the Action Button just asked for, once; null if none. */
export function takeLaunchAction(): LaunchAction | null {
  const action = iphone?.takeLaunchAction();
  return action === 'listen' || action === 'readAloud' || action === 'readCopied' ? action : null;
}

/**
 * Calls `handle` whenever Siri, the Action Button or a shortcut opens
 * SmartAssist with a job, including the one that started the app.
 */
export function useLaunchActions(handle: (action: LaunchAction) => void, enabled = true): void {
  useEffect(() => {
    if (!iphone || !enabled) return;
    const check = () => {
      const action = takeLaunchAction();
      if (action) handle(action);
    };
    const subscription = iphone.addListener('onLaunchAction', check);
    check();
    return () => subscription.remove();
  }, [handle, enabled]);
}
