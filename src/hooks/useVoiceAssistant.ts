import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import { phoneTools } from '@/services/phoneTools';
import { speakAndWait, stopSpeaking, type Voice } from '@/services/speech';
import { carryOut, EXPECTED_WORDS, heardYes, reply } from '@/services/voiceAssistant';
import { useAppTheme } from '@/theme/ThemeContext';

import { cancelListening, canListenInApp, listenOnce, stopListening } from '../../modules/screen-reader';

/**
 * idle: waiting for the user. listening: the microphone is on.
 * working: carrying out a command. asking: waiting for yes or no.
 */
export type AssistantPhase = 'idle' | 'listening' | 'working' | 'asking';

/**
 * The voice assistant inside the app, used on iPhone (Android has its own,
 * over every app). Owner: Kosisochukwu.
 *
 * listen() hears one command and carries it out. typed() does the same for
 * a typed command, for people who can't or don't want to speak (and in Expo
 * Go, where the app can't listen). Questions before sending or calling are
 * shown with Yes and No buttons and also answered by voice.
 */
export function useVoiceAssistant() {
  const { settings } = useAppTheme();
  const [phase, setPhase] = useState<AssistantPhase>('idle');
  const [heard, setHeard] = useState('');
  const [said, setSaid] = useState('');
  const [question, setQuestion] = useState<string | null>(null);

  const voice = useRef<Voice>({ rate: settings.voiceRate, pitch: settings.voicePitch });
  useEffect(() => {
    voice.current = { rate: settings.voiceRate, pitch: settings.voicePitch };
  }, [settings.voiceRate, settings.voicePitch]);

  const busy = useRef(false);
  const mounted = useRef(true);
  const pendingAnswer = useRef<((yes: boolean) => void) | null>(null);

  /** Gives the open question its answer, once. */
  const settle = useCallback((yes: boolean) => {
    const resolve = pendingAnswer.current;
    pendingAnswer.current = null;
    resolve?.(yes);
  }, []);

  // Leaving the screen stops everything; an open question counts as "no".
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelListening();
      settle(false);
      void stopSpeaking();
    };
  }, [settle]);

  const say = useCallback(async (text: string) => {
    if (!mounted.current) return;
    setSaid(text);
    await speakAndWait(text, voice.current);
  }, []);

  const ask = useCallback(
    async (text: string) => {
      if (!mounted.current) return false;
      const answered = new Promise<boolean>((resolve) => {
        pendingAnswer.current = resolve;
      });
      setHeard('');
      setQuestion(text);
      setPhase('asking');
      await say(text);
      // Listen for "yes" or "no", unless a button was tapped while it spoke.
      if (canListenInApp && pendingAnswer.current && mounted.current) {
        void Haptics.selectionAsync().catch(() => undefined);
        const result = await listenOnce({ shortAnswer: true, onWords: setHeard });
        // Like Android: anything but a clear "yes" is a no, so nothing is sent by mistake.
        if (result.kind !== 'cancelled') settle(result.kind === 'heard' && heardYes(result.text));
      }
      const yes = await answered;
      if (mounted.current) {
        setQuestion(null);
        setPhase('working');
      }
      return yes;
    },
    [say, settle],
  );

  /** The Yes and No buttons. */
  const answer = useCallback(
    (yes: boolean) => {
      settle(yes);
      cancelListening();
      void stopSpeaking();
    },
    [settle],
  );

  const run = useCallback(
    async (words: string) => {
      setHeard(words);
      setPhase('working');
      await carryOut(words, { ...phoneTools, say, ask });
    },
    [say, ask],
  );

  /** Speak button: listen for one command and carry it out. */
  const listen = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setHeard('');
      setQuestion(null);
      setPhase('listening');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      await say(reply('listening'));
      const result = await listenOnce({ contextualStrings: EXPECTED_WORDS, onWords: setHeard });
      if (!mounted.current) return;
      if (result.kind === 'heard') {
        await run(result.text);
      } else if (result.kind !== 'cancelled') {
        setPhase('working');
        const key = result.kind === 'nothing' ? 'notHeard' : result.kind === 'denied' ? 'needSpeech' : 'noSpeech';
        await say(reply(key));
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPhase('idle');
    }
  }, [say, run]);

  /** "Do it" button: carry out a typed (or dictated) command. */
  const typed = useCallback(
    async (words: string) => {
      if (busy.current || !words.trim()) return;
      busy.current = true;
      try {
        await stopSpeaking();
        await run(words.trim());
      } finally {
        busy.current = false;
        if (mounted.current) setPhase('idle');
      }
    },
    [run],
  );

  /** "I've finished" button: stop listening and use what was heard. */
  const finishTalking = useCallback(() => stopListening(), []);

  /** Cancel button: stop listening or talking; an open question counts as "no". */
  const cancel = useCallback(() => {
    cancelListening();
    settle(false);
    void stopSpeaking();
  }, [settle]);

  return {
    phase,
    /** The words heard (or typed) for the current command or answer. */
    heard,
    /** The last thing SmartAssist said. */
    said,
    /** The yes-or-no question waiting for an answer, if any. */
    question,
    /** False in Expo Go and on the web: commands can only be typed there. */
    canListen: canListenInApp,
    listen,
    typed,
    answer,
    finishTalking,
    cancel,
  };
}
