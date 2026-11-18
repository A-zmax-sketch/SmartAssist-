import { isRecord, persisted } from '@/storage/persisted';

/**
 * Resume after an interruption: Read Aloud remembers the text and the
 * sentence it stopped at, so "Continue" picks up there, even after a phone
 * call or closing the app.
 * Owner: Kosisochukwu (feature 8, Resume).
 */
export type ReadAloudPlace = {
  text: string;
  /** The sentence it stopped at, counting from 0. */
  sentence: number;
};

function cleanPlace(saved: unknown): ReadAloudPlace | null {
  if (!isRecord(saved) || typeof saved.text !== 'string' || !saved.text.trim()) return null;
  const sentence = typeof saved.sentence === 'number' && saved.sentence >= 0 ? Math.floor(saved.sentence) : 0;
  return { text: saved.text, sentence };
}

export const readAloudPlace = persisted<ReadAloudPlace | null>('smartassist.readAloud.v1', null, cleanPlace);
