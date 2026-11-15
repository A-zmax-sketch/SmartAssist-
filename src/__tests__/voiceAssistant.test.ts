import voice from '../../modules/screen-reader/android/src/main/assets/voice-commands.json';

import { normalize } from '@/services/voiceCommands';
import {
  type AssistantTools,
  carryOut,
  findIphoneApp,
  iphoneApps,
  internationalDigits,
  pickContact,
  reply,
} from '@/services/voiceAssistant';

const MUM = { name: 'Mum', number: '0803 123 4567' };

/** A pretend iPhone: Mum in contacts, WhatsApp installed, and an answer ready for any question. */
function pretendPhone(overrides: Partial<AssistantTools> & { answer?: boolean } = {}) {
  const said: string[] = [];
  const asked: string[] = [];
  const opened: string[] = [];
  const tools: AssistantTools = {
    say: async (text) => {
      said.push(text);
    },
    ask: async (question) => {
      asked.push(question);
      return overrides.answer ?? true;
    },
    findContact: async (name) => pickContact(name, [MUM, { name: 'Grace Okafor', number: '+234 812 000 1111' }]),
    canOpen: async (link) => !link.startsWith('telegram'),
    open: async (link) => {
      opened.push(link);
      return true;
    },
    sendText: async () => 'sent',
    batteryPercent: async () => 76,
    now: () => new Date(2026, 10, 15, 9, 36),
    region: () => 'NG',
    ...overrides,
  };
  return { tools, said, asked, opened };
}

describe('iPhone voice assistant', () => {
  test('opens an app it knows by its link, after saying so', async () => {
    const phone = pretendPhone();
    await carryOut('Open WhatsApp', phone.tools);
    expect(phone.said).toEqual(['Opening WhatsApp.']);
    expect(phone.opened).toEqual(['whatsapp://']);
  });

  test('an app iPhone can’t open by link: suggests asking Siri', async () => {
    const phone = pretendPhone();
    await carryOut('launch the camera', phone.tools);
    expect(phone.said).toEqual([reply('iphoneCantOpen', { app: 'Camera' })]);
    expect(phone.opened).toEqual([]);
  });

  test('a known app that isn’t installed', async () => {
    const phone = pretendPhone({ canOpen: async () => false });
    await carryOut('open telegram', phone.tools);
    expect(phone.said).toEqual([reply('notInstalled', { app: 'Telegram' })]);
  });

  test('WhatsApp message: reads it back, and after "yes" opens the chat with the message typed in', async () => {
    const phone = pretendPhone();
    await carryOut("Send a message to Mum saying I'm on my way", phone.tools);

    expect(phone.asked).toEqual(["Send: I'm on my way. To Mum, on WhatsApp? Say yes or no."]);
    expect(phone.opened).toEqual(["whatsapp://send?phone=2348031234567&text=I'm%20on%20my%20way"]);
    expect(phone.said).toEqual([reply('iphoneTapSend', { contact: 'Mum' })]);
  });

  test('"no" sends nothing', async () => {
    const phone = pretendPhone({ answer: false });
    await carryOut('message mum saying hello', phone.tools);
    expect(phone.opened).toEqual([]);
    expect(phone.said).toEqual([reply('cancelled')]);
  });

  test('a text message opens Apple’s message sheet after "yes"', async () => {
    const sendText = jest.fn(async () => 'sent' as const);
    const phone = pretendPhone({ sendText });
    await carryOut('text Mum saying I am home', phone.tools);
    expect(phone.asked[0]).toContain('on text message');
    expect(sendText).toHaveBeenCalledWith('0803 123 4567', 'I am home');
    expect(phone.said).toEqual([reply('iphoneSmsReady', { contact: 'Mum' }), reply('sent', { contact: 'Mum' })]);
  });

  test('calls only after "yes", with the number', async () => {
    const phone = pretendPhone();
    await carryOut('call grace', phone.tools);
    expect(phone.asked).toEqual(['Call Grace Okafor? Say yes or no.']);
    expect(phone.opened).toEqual(['tel:+2348120001111']);
  });

  test('someone not in contacts, and contacts not allowed', async () => {
    const notFound = pretendPhone();
    await carryOut('call aunty ngozi', notFound.tools);
    expect(notFound.said).toEqual([reply('noContact', { contact: 'Aunty Ngozi' })]);

    const denied = pretendPhone({ findContact: async () => 'denied' });
    await carryOut('call mum', denied.tools);
    expect(denied.said).toEqual([reply('needContacts', { contact: 'Mum' })]);
    expect(denied.asked).toEqual([]);
  });

  test('"read the screen" explains Apple’s Speak Screen', async () => {
    const phone = pretendPhone();
    await carryOut("what's on my screen", phone.tools);
    expect(phone.said).toEqual([reply('iphoneReadScreen')]);
  });

  test('time, battery and words it doesn’t know', async () => {
    const phone = pretendPhone();
    await carryOut('how much battery do I have', phone.tools);
    await carryOut('make me a sandwich', phone.tools);
    expect(phone.said).toEqual(['Your battery is at 76 percent.', reply('notUnderstood')]);

    const noBattery = pretendPhone({ batteryPercent: async () => null });
    await carryOut('battery', noBattery.tools);
    expect(noBattery.said).toEqual([reply('noBattery')]);
  });
});

describe('contacts and numbers', () => {
  const people = [
    { name: 'Grace Okafor', number: '1' },
    { name: 'Mummy', number: '2' },
    { name: 'Mum', number: '3' },
  ];

  test('whole name first, then the start of a name, then one word of it', () => {
    expect(pickContact('mum', people)?.number).toBe('3');
    expect(pickContact('grace', people)?.number).toBe('1');
    expect(pickContact('okafor', people)?.number).toBe('1');
    expect(pickContact('', people)).toBeNull();
  });

  test('local numbers get the country code, as WhatsApp needs', () => {
    expect(internationalDigits('0803 123 4567', 'NG')).toBe('2348031234567');
    expect(internationalDigits('+44 7700 900123', 'NG')).toBe('447700900123');
    expect(internationalDigits('00233 24 123 4567', 'NG')).toBe('233241234567');
    expect(internationalDigits('0803 123 4567', null)).toBe('8031234567');
  });
});

describe('iphoneApps in voice-commands.json', () => {
  test('every app has a link and names that can be heard', () => {
    for (const app of iphoneApps) {
      expect(app.link).toMatch(/^[a-z-]+:/);
      app.say.forEach((word) => expect(normalize(word)).toBe(word.replace(/’/g, "'")));
      expect(findIphoneApp(app.say[0])?.name).toBe(app.name);
    }
  });

  test('"the" and "app" are ignored', () => {
    expect(findIphoneApp('the WhatsApp app')?.name).toBe('WhatsApp');
  });

  test('every iPhone reply has words', () => {
    const iphoneReplies = [
      'needSpeech', 'noSpeech', 'notInstalled', 'iphoneCantOpen', 'iphoneReadScreen',
      'iphoneTapSend', 'iphoneSmsReady', 'iphoneCalling', 'noBattery', 'cantCall',
    ];
    for (const key of iphoneReplies) {
      expect(voice.replies).toHaveProperty(key, expect.stringMatching(/\S/));
    }
  });
});
