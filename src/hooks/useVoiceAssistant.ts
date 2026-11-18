import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { appReply, runAppCommand, type AppTools } from '@/services/appCommands';
import { useFeedback } from '@/services/feedback';
import { phoneTools } from '@/services/phoneTools';
import { getLastPlayer, sendToScreen, type RequestScreen } from '@/services/screenRequests';
import { stopSpeaking } from '@/services/speech';
import { carryOut, EXPECTED_WORDS, heardYes, reply } from '@/services/voiceAssistant';
import { logCommand } from '@/storage/historyStore';
import { routineProgress, routines } from '@/storage/routinesStore';
import { savedTexts } from '@/storage/savedTextsStore';
import { useAppTheme } from '@/theme/ThemeContext';

import { cancelListening, canListenInApp, carryOutCommand, listenOnce, stopListening } from '../../modules/screen-reader';

/**
 * idle: waiting for the user. listening: the microphone is on.
 * working: carrying out a command. asking: waiting for yes or no.
 */
export type AssistantPhase = 'idle' | 'listening' | 'working' | 'asking';

/** Where each screen that takes commands lives. */
const SCREEN_HREFS: Record<RequestScreen, Href> = {
  readAloud: '/read-aloud',
  routine: '/routine-player',
  find: '/find',
  magnifier: '/magnifier',
};

/**
 * The voice assistant inside the app, on both phones.
 * Owner: Kosisochukwu (assistant), The Revenant (Voice Command screen).
 *
 * listen() hears one command (iPhone: Apple's speech recognition here;
 * Android: the Listening card) and carries it out. typed() does the same for
 * a typed command, for people who can't or don't want to speak, and in Expo
 * Go, where the app can't listen.
 *
 * SmartAssist's own commands ("bigger text", "start laundry") are tried
 * first. Anything else is a phone command: on iPhone this hook does it
 * (asking before sending or calling, with Yes and No buttons); on Android
 * the screen reader's assistant does it, over any app.
 * Every command is written to Command History.
 */
export function useVoiceAssistant() {
  const { settings, updateSettings } = useAppTheme();
  const feedback = useFeedback();
  const [phase, setPhase] = useState<AssistantPhase>('idle');
  const [heard, setHeard] = useState('');
  const [said, setSaid] = useState('');
  const [question, setQuestion] = useState<string | null>(null);

  const latestSettings = useRef(settings);
  useEffect(() => {
    latestSettings.current = settings;
  }, [settings]);

  const busy = useRef(false);
  const mounted = useRef(true);
  /** True once a command has sent the user to another screen: its reply keeps playing. */
  const leaving = useRef(false);
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
      if (!leaving.current) void stopSpeaking();
    };
  }, [settle]);

  const say = useCallback(
    async (text: string) => {
      if (!mounted.current) return;
      setSaid(text);
      await feedback.say(text);
    },
    [feedback],
  );

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
        feedback.buzz('listening');
        const result = await listenOnce({ shortAnswer: true, onWords: setHeard, prompt: reply('confirmListening') });
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
    [say, settle, feedback],
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
      setSaid('');
      setPhase('working');
      leaving.current = false;
      await Promise.all([routineProgress.load(), routines.load()]);

      const go = (href: Href) => {
        leaving.current = true;
        router.dismissTo(href);
      };
      const appTools: AppTools = {
        settings: latestSettings.current,
        updateSettings,
        go,
        tell: (screen, action, value) => {
          sendToScreen(screen, action, value);
          go(SCREEN_HREFS[screen]);
        },
        routines: () => routines.load(),
        savedTextCount: async () => (await savedTexts.load()).length,
        startRoutine: (routine) => routineProgress.set({ routineId: routine.id, step: 0 }),
        routineGoing: () => routineProgress.get() != null,
        lastPlayer: getLastPlayer,
      };

      // 1. SmartAssist's own commands.
      const done = await runAppCommand(words, appTools);
      if (done) {
        void logCommand(words, done.reply || done.action);
        if (!done.screenSpeaks && done.reply) {
          setSaid(done.reply);
          // A command that opened another screen keeps talking there; others finish here.
          if (leaving.current) void feedback.say(done.reply);
          else await say(done.reply);
        }
        return;
      }

      // 2. Phone commands: apps, messages, calls, time, battery.
      if (Platform.OS === 'android') {
        const sent = carryOutCommand(words);
        const answerText = sent ? appReply('androidPhoneCommand') : appReply('androidNeedsReader');
        void logCommand(words, answerText);
        if (sent) setSaid(answerText);
        else await say(answerText);
        return;
      }
      let last = '';
      await carryOut(words, {
        ...phoneTools,
        say: async (text) => {
          last = text;
          await say(text);
        },
        ask,
      });
      void logCommand(words, last);
    },
    [say, ask, feedback, updateSettings],
  );

  /** Speak button: listen for one command and carry it out. */
  const listen = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setHeard('');
      setSaid('');
      setQuestion(null);
      setPhase('listening');
      feedback.buzz('listening');
      // iPhone says "Listening"; Android's card shows it, and talking would reach its microphone.
      if (Platform.OS !== 'android') await say(reply('listening'));
      const result = await listenOnce({ contextualStrings: EXPECTED_WORDS, onWords: setHeard, prompt: reply('listening') });
      if (!mounted.current) return;
      if (result.kind === 'heard') {
        await run(result.text);
      } else if (result.kind !== 'cancelled') {
        setPhase('working');
        const key = result.kind === 'nothing' ? 'notHeard' : result.kind === 'denied' ? 'needSpeech' : 'noSpeech';
        feedback.buzz('notUnderstood');
        await say(reply(key));
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPhase('idle');
    }
  }, [say, run, feedback]);

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
    if (!leaving.current) void stopSpeaking();
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
