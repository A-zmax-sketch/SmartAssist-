import voice from '../../modules/screen-reader/android/src/main/assets/voice-commands.json';

import { matchCommand, normalize, yesOrNo, type VoiceCommand } from '@/services/voiceCommands';

const commands = voice.commands as VoiceCommand[];

describe('voice-commands.json', () => {
  test('every example is understood as its own command', () => {
    for (const command of commands) {
      for (const example of command.examples ?? []) {
        expect({ example, action: matchCommand(example, commands)?.action }).toEqual({
          example,
          action: command.action,
        });
      }
    }
  });

  test('patterns are lower case and have no punctuation, so they can match', () => {
    for (const command of commands) {
      for (const pattern of command.patterns) {
        const withoutPlaceholders = pattern.replace(/\{\w+\}/g, 'x');
        expect(normalize(withoutPlaceholders)).toBe(withoutPlaceholders);
      }
    }
  });

  test('every reply the assistant uses has words', () => {
    const needed = [
      'listening', 'confirmListening', 'notHeard', 'notUnderstood', 'needMicrophone', 'needContacts',
      'needPhone', 'needSms', 'opening', 'noApp', 'noContact', 'confirmMessage', 'confirmCall',
      'cancelled', 'cancelledCall', 'sent', 'pressSend', 'noMessenger', 'unsupportedMessenger',
      'calling', 'time', 'date', 'battery', 'help',
    ];
    for (const key of needed) {
      expect(voice.replies).toHaveProperty(key, expect.stringMatching(/\S/));
    }
  });

  test('wake words are written so they can be recognised', () => {
    expect(voice.wakeWords.length).toBeGreaterThan(0);
    voice.wakeWords.forEach((wake) => expect(normalize(wake)).toBe(wake));
  });

  test('the default messenger and every fixed messenger are known', () => {
    const known = Object.keys(voice.messengers);
    expect(known).toContain(voice.defaultMessenger);
    commands.filter((c) => c.messenger).forEach((c) => expect(known).toContain(c.messenger));
  });
});

describe('matchCommand', () => {
  test('pulls out the contact and the message', () => {
    expect(matchCommand("Send a message to Mum saying I'm on my way.", commands)).toEqual({
      action: 'sendMessage',
      values: { contact: 'mum', message: "i'm on my way" },
    });
  });

  test('a named messenger is kept, and "text … saying" means SMS', () => {
    expect(matchCommand('send a WhatsApp message to Tunde saying call me', commands)?.values).toEqual({
      messenger: 'whatsapp',
      contact: 'tunde',
      message: 'call me',
    });
    expect(matchCommand('Text David saying I am home', commands)?.values.messenger).toBe('sms');
  });

  test('contacts with two names stay together', () => {
    expect(matchCommand('tell Aunty Ngozi that the meeting is at five', commands)?.values.contact).toBe(
      'aunty ngozi',
    );
  });

  test('opens any app by name', () => {
    expect(matchCommand('Open Telegram', commands)).toEqual({ action: 'openApp', values: { app: 'telegram' } });
  });

  test('says nothing matched for something it does not know', () => {
    expect(matchCommand('make me a sandwich', commands)).toBeNull();
  });
});

describe('yesOrNo', () => {
  const answer = (heard: string) => yesOrNo(heard, voice.yesWords, voice.noWords);

  test('understands yes and no', () => {
    expect(answer('Yes')).toBe('yes');
    expect(answer('yeah send it')).toBe('yes');
    expect(answer('No')).toBe('no');
  });

  test('"no" wins when both are heard', () => {
    expect(answer("no don't send it")).toBe('no');
  });

  test('anything else is neither', () => {
    expect(answer('banana')).toBeNull();
  });
});
