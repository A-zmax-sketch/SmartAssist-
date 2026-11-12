import * as Speech from 'expo-speech';

import {
  MAX_CHUNK_LENGTH,
  createSentenceReader,
  describeRate,
  fasterRate,
  slowerRate,
  splitIntoSentences,
} from '@/services/speech';

// Tests can't make sound, so swap the real expo-speech for a pretend one
// that just records what it was asked to say.
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));

const speakMock = Speech.speak as jest.Mock;
const NORMAL_VOICE = () => ({ rate: 1, pitch: 1 });

/** The sentences the pretend voice was asked to say, in order. */
const spoken = () => speakMock.mock.calls.map((call) => call[0]);

/** Pretends the voice finished the most recent sentence. */
const finishCurrentSentence = () => {
  const lastCall = speakMock.mock.calls[speakMock.mock.calls.length - 1];
  lastCall[1].onDone();
};

beforeEach(() => {
  speakMock.mockClear();
});

describe('splitIntoSentences', () => {
  test('splits at full stops, question marks and exclamation marks', () => {
    expect(splitIntoSentences('Hello there. How are you? Great!')).toEqual([
      'Hello there.',
      'How are you?',
      'Great!',
    ]);
  });

  test('splits at line breaks and drops empty lines', () => {
    expect(splitIntoSentences('Room B12\n\n  Turn left  ')).toEqual(['Room B12', 'Turn left']);
  });

  test('keeps numbers like 3.5 in one piece', () => {
    expect(splitIntoSentences('Take 3.5 ml twice a day.')).toEqual(['Take 3.5 ml twice a day.']);
  });

  test('returns nothing for empty or blank text', () => {
    expect(splitIntoSentences('')).toEqual([]);
    expect(splitIntoSentences('   \n  ')).toEqual([]);
  });

  test('cuts a very long sentence into pieces at spaces', () => {
    const longSentence = Array(120).fill('word').join(' '); // 599 characters
    const pieces = splitIntoSentences(longSentence);

    expect(pieces.length).toBeGreaterThan(1);
    pieces.forEach((piece) => expect(piece.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH));
    expect(pieces.join(' ')).toBe(longSentence); // no words lost
  });
});

describe('speed steps', () => {
  test('Slower and Faster step through the speeds', () => {
    expect(slowerRate(1)).toBe(0.75);
    expect(fasterRate(1)).toBe(1.25);
  });

  test('speed stays put at the slowest and fastest', () => {
    expect(slowerRate(0.5)).toBe(0.5);
    expect(fasterRate(2)).toBe(2);
  });

  test('each speed has a name', () => {
    expect(describeRate(1)).toBe('Normal');
    expect(describeRate(0.5)).toBe('Very slow');
  });
});

describe('createSentenceReader', () => {
  test('reads the sentences one after another, then says it has finished', async () => {
    const onFinished = jest.fn();
    const reader = createSentenceReader({ onFinished });

    await reader.start(['One.', 'Two.'], 0, NORMAL_VOICE);
    expect(spoken()).toEqual(['One.']);

    finishCurrentSentence();
    expect(spoken()).toEqual(['One.', 'Two.']);

    finishCurrentSentence();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  test('can start part-way through, which is how Pause carries on', async () => {
    const reader = createSentenceReader();

    await reader.start(['One.', 'Two.', 'Three.'], 1, NORMAL_VOICE);

    expect(spoken()).toEqual(['Two.']);
  });

  test('after stop(), a sentence finishing late does not start the next one', async () => {
    const onFinished = jest.fn();
    const reader = createSentenceReader({ onFinished });

    await reader.start(['One.', 'Two.'], 0, NORMAL_VOICE);
    reader.stop();
    finishCurrentSentence(); // the phone reports "done" a moment after Stop

    expect(spoken()).toEqual(['One.']);
    expect(onFinished).not.toHaveBeenCalled();
  });

  test('uses the latest speed for each new sentence', async () => {
    let rate = 1;
    const reader = createSentenceReader();

    await reader.start(['One.', 'Two.'], 0, () => ({ rate, pitch: 1 }));
    rate = 1.5; // the user presses Faster while listening
    finishCurrentSentence();

    expect(speakMock.mock.calls[0][1].rate).toBe(1);
    expect(speakMock.mock.calls[1][1].rate).toBe(1.5);
  });
});
