import * as Speech from 'expo-speech';

/**
 * Speech service: everything in SmartAssist that talks goes through here.
 * Owner: Kosisochukwu.
 *
 * Read Aloud does not use Speech.pause() and Speech.resume(), because the
 * expo-speech docs say they don't work on Android. Instead it splits the text
 * into sentences and speaks them one at a time. To pause, it stops and
 * remembers which sentence it was on; to carry on, it starts that sentence
 * again. This works the same on Android, iPhone and the web.
 */

/** Speed and pitch, as stored in Settings. 1 is normal for both. */
export type Voice = {
  rate: number;
  pitch: number;
};

// ---------------------------------------------------------------------------
// Splitting text into sentences
// ---------------------------------------------------------------------------

/**
 * Longest piece spoken in one go. A very long sentence is cut at a space,
 * so Pause never has to throw away more than this much speech.
 */
export const MAX_CHUNK_LENGTH = 300;

/**
 * Splits text into sentences, the pieces Read Aloud speaks one at a time.
 *
 * A sentence ends at . ! ? or … followed by a space, or at a line break.
 * Numbers like 3.5 stay whole because there is no space after the dot.
 *
 * splitIntoSentences('Hello there. How are you?') → ['Hello there.', 'How are you?']
 */
export function splitIntoSentences(text: string): string[] {
  return text
    .replace(/([.!?…]+["'”’)\]]*)\s+/g, '$1\n') // put a line break after each sentence ending
    .split(/\n+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 0)
    .flatMap(splitLongSentence);
}

/** Cuts a sentence longer than MAX_CHUNK_LENGTH into pieces, at spaces. */
function splitLongSentence(sentence: string): string[] {
  const pieces: string[] = [];
  let rest = sentence;
  while (rest.length > MAX_CHUNK_LENGTH) {
    const lastSpace = rest.lastIndexOf(' ', MAX_CHUNK_LENGTH);
    const cut = lastSpace > 0 ? lastSpace : MAX_CHUNK_LENGTH; // no space at all: cut mid-word
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) {
    pieces.push(rest);
  }
  return pieces;
}

// ---------------------------------------------------------------------------
// Speed steps
// ---------------------------------------------------------------------------

/** The speeds the Slower and Faster buttons step through, slowest first. */
export const SPEECH_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

const RATE_NAMES: Record<number, string> = {
  0.5: 'Very slow',
  0.75: 'Slow',
  1: 'Normal',
  1.25: 'Fast',
  1.5: 'Faster',
  2: 'Very fast',
};

/** What a speed is called on screen, e.g. describeRate(1) → 'Normal'. */
export function describeRate(rate: number): string {
  return RATE_NAMES[rate] ?? `${rate}×`;
}

/** The next slower speed, or the same speed if it is already the slowest. */
export function slowerRate(rate: number): number {
  const slower = SPEECH_RATES.filter((step) => step < rate);
  return slower.length > 0 ? slower[slower.length - 1] : SPEECH_RATES[0];
}

/** The next faster speed, or the same speed if it is already the fastest. */
export function fasterRate(rate: number): number {
  const faster = SPEECH_RATES.filter((step) => step > rate);
  return faster.length > 0 ? faster[0] : SPEECH_RATES[SPEECH_RATES.length - 1];
}

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

/**
 * Says something once, for example a button name or the Welcome introduction.
 * Stops anything already being said first, so voices never pile up.
 */
export async function speak(text: string, voice: Voice): Promise<void> {
  await Speech.stop();
  Speech.speak(text, { rate: voice.rate, pitch: voice.pitch });
}

/** Stops whatever is being said right now. */
export async function stopSpeaking(): Promise<void> {
  await Speech.stop();
}

type ReaderEvents = {
  /** A new sentence has started. `index` counts from 0. */
  onSentenceStart?: (index: number) => void;
  /** The last sentence has finished. */
  onFinished?: () => void;
  /** The phone's voice failed. */
  onError?: () => void;
};

export type SentenceReader = {
  /**
   * Starts reading `sentences` from sentence number `fromIndex` (0 is the first).
   * `getVoice` is asked before every sentence, so a speed change made while
   * reading applies from the next sentence.
   */
  start: (sentences: string[], fromIndex: number, getVoice: () => Voice) => Promise<void>;
  /** Stops reading. No more events arrive until the next start(). */
  stop: () => void;
};

/**
 * Makes a reader that speaks a list of sentences one after another.
 *
 * Each start() gets a new "run number". When a sentence finishes, the reader
 * only moves on if its run is still the current one. That way, pressing
 * Pause or Stop can't be undone by a sentence that finishes a moment later.
 */
export function createSentenceReader(events: ReaderEvents = {}): SentenceReader {
  let currentRun = 0;

  function readFrom(sentences: string[], index: number, getVoice: () => Voice, run: number) {
    if (run !== currentRun) {
      return; // Pause, Stop or a newer start() happened: do nothing.
    }
    if (index >= sentences.length) {
      events.onFinished?.();
      return;
    }

    events.onSentenceStart?.(index);
    const { rate, pitch } = getVoice();
    Speech.speak(sentences[index], {
      rate,
      pitch,
      onDone: () => readFrom(sentences, index + 1, getVoice, run),
      onError: () => {
        if (run === currentRun) {
          events.onError?.();
        }
      },
    });
  }

  return {
    async start(sentences, fromIndex, getVoice) {
      currentRun += 1;
      const run = currentRun;
      await Speech.stop(); // clear anything still playing before starting
      readFrom(sentences, fromIndex, getVoice, run);
    },
    stop() {
      currentRun += 1;
      void Speech.stop();
    },
  };
}
