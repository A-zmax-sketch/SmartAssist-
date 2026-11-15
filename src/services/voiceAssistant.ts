/**
 * SmartAssist's voice assistant on iPhone: "open WhatsApp", "send a message
 * to Mum saying I'm on my way", "call Mum", "what time is it", and so on.
 * Owner: Kosisochukwu.
 *
 * It does the same jobs as the Android assistant (VoiceAssistant.kt), with the
 * same commands and replies from voice-commands.json, within what Apple
 * allows:
 * - Apps open by their link (whatsapp://), so only the apps in iphoneApps.
 *   For anything else it tells the user to ask Siri.
 * - It can't press WhatsApp's Send button, so it opens the chat with the
 *   message typed in and tells the user to tap Send. Texts open in Apple's
 *   message sheet with the words filled in.
 * - It can't read other apps, so "read the screen" explains Speak Screen.
 * Like Android, it reads back every message and call and only goes ahead
 * after a clear "yes".
 *
 * The phone itself is reached through AssistantTools, so the tests can use
 * pretend contacts, apps and answers.
 */
import voice from '../../modules/screen-reader/android/src/main/assets/voice-commands.json';

import { matchCommand, normalize, type VoiceCommand, yesOrNo } from './voiceCommands';

export const commands = voice.commands as VoiceCommand[];

/** True only for a clear "yes" ("yes", "send it"…). "No" wins if both are heard. */
export function heardYes(answer: string): boolean {
  return yesOrNo(answer, voice.yesWords, voice.noWords) === 'yes';
}

export type ReplyKey = keyof typeof voice.replies;

/** A reply from voice-commands.json with its {placeholders} filled in. */
export function reply(key: ReplyKey, values: Record<string, string> = {}): string {
  return voice.replies[key].replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}

// ---------------------------------------------------------------------------
// Apps, contacts and phone numbers
// ---------------------------------------------------------------------------

export type IphoneApp = { name: string; say: string[]; link: string };

export const iphoneApps = voice.iphoneApps as IphoneApp[];

/** The app the user named, e.g. "the WhatsApp app" → WhatsApp, or null. */
export function findIphoneApp(spoken: string): IphoneApp | null {
  const wanted = withoutFillers(spoken);
  return (
    iphoneApps.find((app) => normalize(app.name) === wanted || app.say.some((word) => normalize(word) === wanted)) ??
    null
  );
}

/** "the camera app" → "camera". */
function withoutFillers(spoken: string): string {
  return normalize(spoken)
    .replace(/^(the|my) /, '')
    .replace(/ app$/, '');
}

/** "whatsapp", "sms", or null for a messenger SmartAssist can't use. No messenger named → WhatsApp. */
export function messengerKey(spoken: string | undefined): string | null {
  if (spoken == null) return voice.defaultMessenger;
  const word = normalize(spoken);
  const entry = Object.entries(voice.messengers).find(
    ([key, words]) => key === word || words.some((w) => normalize(w) === word),
  );
  return entry?.[0] ?? null;
}

export type Contact = { name: string; number: string };

/**
 * The contact the user meant, tried in the same order as Android:
 * the whole name, then the start of it, then one of its words, then any part.
 */
export function pickContact(spoken: string, contacts: Contact[]): Contact | null {
  const simplify = (text: string) => normalize(text).replace(/'/g, '');
  const wanted = simplify(spoken);
  if (!wanted) return null;
  const named = contacts.map((contact) => ({ contact, name: simplify(contact.name) }));
  const found =
    named.find(({ name }) => name === wanted) ??
    named.find(({ name }) => name.startsWith(wanted)) ??
    named.find(({ name }) => name.split(' ').includes(wanted)) ??
    named.find(({ name }) => name.includes(wanted));
  return found?.contact ?? null;
}

/** Calling codes for countries where local numbers start with 0 (same list as Android). */
const COUNTRY_CODES: Record<string, string> = {
  NG: '234', GH: '233', KE: '254', ZA: '27', GB: '44', IE: '353',
  IN: '91', FR: '33', DE: '49', AE: '971', EG: '20', CM: '237',
};

/**
 * WhatsApp wants the full international number, digits only. A local number
 * like 0803 123 4567 gets the phone's country code (234 in Nigeria).
 */
export function internationalDigits(number: string, region: string | null): string {
  const trimmed = number.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return (COUNTRY_CODES[region?.toUpperCase() ?? ''] ?? '') + digits.slice(1);
  return digits;
}

/** "aunty ngozi" → "Aunty Ngozi": speech arrives in lower case, names look better capitalised. */
export function titleCase(words: string): string {
  return words.replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Carrying out a command
// ---------------------------------------------------------------------------

/** What the assistant needs from the phone. */
export type AssistantTools = {
  /** Says something, shows it, and finishes when it has been said. */
  say(text: string): Promise<void>;
  /** Asks a yes-or-no question (shown, said aloud, answered by voice or button). True only for a clear yes. */
  ask(question: string): Promise<boolean>;
  /** The contact with this name, 'denied' if contacts aren't allowed, or null if not found. */
  findContact(name: string): Promise<Contact | 'denied' | null>;
  canOpen(link: string): Promise<boolean>;
  open(link: string): Promise<boolean>;
  /** Shows Apple's message sheet with the text filled in. */
  sendText(number: string, message: string): Promise<'sent' | 'cancelled' | 'unknown' | 'unavailable'>;
  /** 0–100, or null if the phone won't say. */
  batteryPercent(): Promise<number | null>;
  now(): Date;
  /** The phone's country, e.g. "NG". */
  region(): string | null;
};

/** Does what the words ask, talking the user through it. */
export async function carryOut(heard: string, tools: AssistantTools): Promise<void> {
  const match = matchCommand(heard, commands);
  if (!match) {
    return tools.say(reply('notUnderstood'));
  }
  const values = match.values;
  switch (match.action) {
    case 'openApp':
      return openApp(values.app ?? '', tools);
    case 'sendMessage':
      return sendMessage(values.contact ?? '', values.message ?? '', values.messenger, tools);
    case 'call':
      return call(values.contact ?? '', tools);
    case 'readScreen':
      return tools.say(reply('iphoneReadScreen'));
    case 'time':
      return tools.say(reply('time', { time: tools.now().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }));
    case 'date':
      return tools.say(
        reply('date', {
          date: tools.now().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        }),
      );
    case 'battery': {
      const percent = await tools.batteryPercent();
      return tools.say(percent == null ? reply('noBattery') : reply('battery', { percent: String(percent) }));
    }
    case 'help':
      return tools.say(reply('help'));
    default:
      return tools.say(reply('notUnderstood'));
  }
}

async function openApp(spoken: string, tools: AssistantTools): Promise<void> {
  const app = findIphoneApp(spoken);
  if (!app) {
    return tools.say(reply('iphoneCantOpen', { app: titleCase(withoutFillers(spoken)) }));
  }
  if (!(await tools.canOpen(app.link))) {
    return tools.say(reply('notInstalled', { app: app.name }));
  }
  // Say it first: once the other app is open, SmartAssist can't be heard.
  await tools.say(reply('opening', { app: app.name }));
  if (!(await tools.open(app.link))) {
    await tools.say(reply('notInstalled', { app: app.name }));
  }
}

async function lookUp(spoken: string, tools: AssistantTools): Promise<Contact | null> {
  const found = await tools.findContact(spoken);
  if (found === 'denied') {
    await tools.say(reply('needContacts', { contact: titleCase(spoken) }));
    return null;
  }
  if (!found) {
    await tools.say(reply('noContact', { contact: titleCase(spoken) }));
    return null;
  }
  return found;
}

async function sendMessage(
  contactName: string,
  message: string,
  spokenMessenger: string | undefined,
  tools: AssistantTools,
): Promise<void> {
  const messenger = messengerKey(spokenMessenger);
  if (!messenger) {
    return tools.say(reply('unsupportedMessenger', { messenger: titleCase(spokenMessenger ?? '') }));
  }
  const contact = await lookUp(contactName, tools);
  if (!contact) return;

  const text = capitalise(message);
  const question = reply('confirmMessage', {
    message: text,
    contact: contact.name,
    messenger: messenger === 'sms' ? 'text message' : 'WhatsApp',
  });
  if (!(await tools.ask(question))) {
    return tools.say(reply('cancelled'));
  }

  if (messenger === 'sms') {
    await tools.say(reply('iphoneSmsReady', { contact: contact.name }));
    const result = await tools.sendText(contact.number, text);
    if (result === 'sent') return tools.say(reply('sent', { contact: contact.name }));
    if (result === 'cancelled') return tools.say(reply('cancelled'));
    if (result === 'unavailable') return tools.say(reply('noMessenger', { messenger: 'Text messaging' }));
    return;
  }

  if (!(await tools.canOpen('whatsapp://'))) {
    return tools.say(reply('noMessenger', { messenger: 'WhatsApp' }));
  }
  const phone = internationalDigits(contact.number, tools.region());
  await tools.say(reply('iphoneTapSend', { contact: contact.name }));
  if (!(await tools.open(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`))) {
    await tools.say(reply('noMessenger', { messenger: 'WhatsApp' }));
  }
}

async function call(contactName: string, tools: AssistantTools): Promise<void> {
  const contact = await lookUp(contactName, tools);
  if (!contact) return;
  if (!(await tools.ask(reply('confirmCall', { contact: contact.name })))) {
    return tools.say(reply('cancelledCall'));
  }
  // Say it first: once the call starts, the call takes over the sound.
  await tools.say(reply('iphoneCalling', { contact: contact.name }));
  if (!(await tools.open(`tel:${contact.number.replace(/[^\d+*#]/g, '')}`))) {
    await tools.say(reply('cantCall'));
  }
}

/** Names the speech recogniser should expect, so "WhatsApp" isn't heard as "what's up". */
export const EXPECTED_WORDS = ['SmartAssist', ...iphoneApps.map((app) => app.name)];
