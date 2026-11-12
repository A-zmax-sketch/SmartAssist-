/**
 * Understanding voice commands: turns heard words into an action.
 * Owner: Kosisochukwu.
 *
 * The commands themselves (patterns, examples, replies) live in
 * modules/screen-reader/android/src/main/assets/voice-commands.json, shared
 * with the Android assistant. This file follows exactly the same rules as
 * VoiceCommands.kt, so the tests here also check what the phone will do.
 *
 * A pattern is ordinary words plus {placeholders}:
 *   "send a message to {contact} saying {message}"
 * matches "Send a message to Mum saying I'm on my way" with
 *   { contact: "mum", message: "i'm on my way" }.
 */

export type VoiceCommand = {
  action: string;
  patterns: string[];
  examples?: string[];
  /** A messenger this command always uses, e.g. "sms" for "text {contact} …". */
  messenger?: string;
};

export type CommandMatch = {
  action: string;
  /** The placeholder values, e.g. { contact: 'mum', message: "i'm on my way" }. */
  values: Record<string, string>;
};

/**
 * Lower case, curly apostrophes made straight, punctuation removed and
 * spaces tidied, so "What's the time?" and "whats the time" compare well.
 */
export function normalize(heard: string): string {
  return heard
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "open {app}" → /^open (.+?)$/ and the placeholder names ['app']. */
export function patternToRegex(pattern: string): { regex: RegExp; names: string[] } {
  const names: string[] = [];
  const source = pattern
    .split(/(\{\w+\})/)
    .map((part) => {
      const placeholder = part.match(/^\{(\w+)\}$/);
      if (placeholder) {
        names.push(placeholder[1]);
        return '(.+?)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return { regex: new RegExp(`^${source}$`), names };
}

/** The first command whose pattern fits the heard words, or null. */
export function matchCommand(heard: string, commands: VoiceCommand[]): CommandMatch | null {
  const text = normalize(heard);
  for (const command of commands) {
    for (const pattern of command.patterns) {
      const { regex, names } = patternToRegex(pattern);
      const found = text.match(regex);
      if (found) {
        const values: Record<string, string> = {};
        names.forEach((name, i) => {
          values[name] = found[i + 1].trim();
        });
        if (command.messenger && !values.messenger) {
          values.messenger = command.messenger;
        }
        return { action: command.action, values };
      }
    }
  }
  return null;
}

/**
 * Whether an answer means yes, no, or neither. "No" wins if both appear,
 * so "no, don't send it" is a no.
 */
export function yesOrNo(heard: string, yesWords: string[], noWords: string[]): 'yes' | 'no' | null {
  const text = ` ${normalize(heard)} `;
  const has = (words: string[]) => words.some((word) => text.includes(` ${normalize(word)} `));
  if (has(noWords)) return 'no';
  if (has(yesWords)) return 'yes';
  return null;
}
