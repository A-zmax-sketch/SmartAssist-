import { useCallback, useEffect, useRef, useState } from 'react';

import { setLastPlayer } from '@/services/screenRequests';
import { createSentenceReader, splitIntoSentences, type Voice } from '@/services/speech';
import { readAloudPlace } from '@/storage/readAloudStore';
import { useAppTheme } from '@/theme/ThemeContext';

/** idle: nothing playing. playing: reading aloud. paused: stopped part-way, Play carries on. */
export type ReadAloudStatus = 'idle' | 'playing' | 'paused';

/**
 * The Play, Pause, Stop and Replay logic for the Read Aloud screen.
 * Owner: Kosisochukwu.
 *
 * It reads `text` one sentence at a time at the speed and pitch chosen in
 * Settings, and remembers which sentence it is on so Pause can carry on
 * from there. The place is also saved on the phone (readAloudStore), so
 * after a phone call or closing the app, "Continue" picks up there.
 */
export function useReadAloud(text: string) {
  const { settings } = useAppTheme();
  const [status, setStatus] = useState<ReadAloudStatus>('idle');
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const sentences = splitIntoSentences(text);

  // The reader asks for the voice before each sentence, so it always gets
  // the latest speed even if the user changes it while listening.
  const voice = useRef<Voice>({ rate: settings.voiceRate, pitch: settings.voicePitch });
  useEffect(() => {
    voice.current = { rate: settings.voiceRate, pitch: settings.voicePitch };
  }, [settings.voiceRate, settings.voicePitch]);
  const getVoice = () => voice.current;

  // One reader for the life of the screen.
  const [reader] = useState(() =>
    createSentenceReader({
      onSentenceStart: setSentenceIndex,
      onFinished: () => {
        setStatus('idle');
        setSentenceIndex(0);
        forgetPlace();
      },
      onError: () => {
        setStatus('idle');
        setFailed(true);
      },
    }),
  );

  // Save the place while reading, so "Continue" works after an interruption.
  useEffect(() => {
    if (status === 'playing') void readAloudPlace.set({ text, sentence: sentenceIndex });
  }, [status, sentenceIndex, text]);

  // Leaving the screen for good stops the voice.
  useEffect(() => () => reader.stop(), [reader]);

  /** Reads from sentence `index` (0 is the first). */
  const startFrom = (index: number) => {
    if (sentences.length === 0) {
      return;
    }
    const from = Math.min(Math.max(index, 0), sentences.length - 1);
    setFailed(false);
    setStatus('playing');
    setSentenceIndex(from);
    setLastPlayer('readAloud');
    void reader.start(sentences, from, getVoice);
  };

  /** Plays from the start, or carries on from where Pause left off. */
  const play = () => startFrom(status === 'paused' ? sentenceIndex : 0);

  /**
   * Stops talking but remembers the sentence, so Play carries on from it.
   * Wrapped in useCallback so it stays the same function between renders:
   * the screen calls it when you leave, and must not call it on every redraw.
   */
  const pause = useCallback(() => {
    reader.stop();
    setStatus((current) => (current === 'playing' ? 'paused' : current));
  }, [reader]);

  /** Stops talking and goes back to the beginning. */
  const stop = () => {
    reader.stop();
    setStatus('idle');
    setSentenceIndex(0);
    forgetPlace();
  };

  /** Starts again from the first sentence. */
  const replay = () => startFrom(0);

  return {
    status,
    /** Which sentence is being read, counting from 0. */
    sentenceIndex,
    sentenceCount: sentences.length,
    /** True if the phone's voice failed last time. */
    failed,
    play,
    /** Reads from a given sentence, e.g. where the user stopped last time. */
    playFrom: startFrom,
    pause,
    stop,
    replay,
  };
}

/** Finished or stopped on purpose: nothing to continue. */
function forgetPlace() {
  if (readAloudPlace.get() != null) void readAloudPlace.set(null);
}
