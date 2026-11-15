import * as Battery from 'expo-battery';
import { Contact as PhoneContact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { getLocales } from 'expo-localization';
import * as SMS from 'expo-sms';
import { Linking } from 'react-native';

import { type AssistantTools, type Contact, pickContact } from '@/services/voiceAssistant';

/**
 * The real phone behind the iPhone voice assistant: contacts, opening apps,
 * texts and the battery. Owner: Kosisochukwu.
 * (Kept apart from voiceAssistant.ts so the tests can use pretend ones.)
 */
export const phoneTools: Omit<AssistantTools, 'say' | 'ask'> = {
  async findContact(name) {
    const permission = await requestPermissionsAsync().catch(() => null);
    if (!permission?.granted) return 'denied';
    const people = await PhoneContact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES]).catch(() => []);
    const withNumbers: Contact[] = people.flatMap((person) => {
      const number = person.phones?.find((phone) => phone.number)?.number;
      return person.fullName && number ? [{ name: person.fullName, number }] : [];
    });
    return pickContact(name, withNumbers);
  },

  canOpen: (link) => Linking.canOpenURL(link).catch(() => false),

  open: (link) =>
    Linking.openURL(link)
      .then(() => true)
      .catch(() => false),

  async sendText(number, message) {
    if (!(await SMS.isAvailableAsync())) return 'unavailable';
    const { result } = await SMS.sendSMSAsync([number], message);
    return result;
  },

  async batteryPercent() {
    const level = await Battery.getBatteryLevelAsync().catch(() => -1);
    return level < 0 ? null : Math.round(level * 100);
  },

  now: () => new Date(),

  region: () => getLocales()[0]?.regionCode ?? null,
};
