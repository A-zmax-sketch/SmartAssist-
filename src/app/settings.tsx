import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { Choice } from '@/components/Choice';
import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { useFeedback, voiceOf } from '@/services/feedback';
import {
  describePitch,
  describeRate,
  fasterRate,
  higherPitch,
  lowerPitch,
  PITCHES,
  slowerRate,
  speak,
  SPEECH_RATES,
} from '@/services/speech';
import { DEFAULT_SETTINGS } from '@/storage/settingsStore';
import { BORDER_WIDTH, RADIUS, TARGET_GAP } from '@/theme/layout';
import { TEXT_SIZE_LABELS, TEXT_SIZE_LEVELS, type TextSizeLevel } from '@/theme/typography';
import { useAppTheme } from '@/theme/ThemeContext';

export const TEST_VOICE_SENTENCE = 'Hello. This is how SmartAssist sounds.';

/**
 * Settings: how SmartAssist looks, sounds and answers.
 * Owners: Kosisochukwu (voice speed and pitch, test voice) and The Revenant
 * (text size, contrast, Speak buttons, Quiet mode, feedback).
 *
 * Every change applies at once to every screen and is saved on the phone.
 * The same settings can be changed by voice: "bigger text", "high contrast
 * on", "faster", "quiet mode on", "more detail".
 */
export default function SettingsScreen() {
  const { colors, settings, updateSettings } = useAppTheme();
  const feedback = useFeedback();
  const [confirmReset, setConfirmReset] = useState(false);

  const rate = settings.voiceRate;
  const pitch = settings.voicePitch;

  const testVoice = () => void speak(TEST_VOICE_SENTENCE, voiceOf(settings));

  const reset = () => {
    setConfirmReset(false);
    // Keep "has seen Welcome", so resetting doesn't send the user back to the start.
    updateSettings({ ...DEFAULT_SETTINGS, hasSeenWelcome: true });
    void feedback.say('Settings reset.');
  };

  return (
    <Screen title="Settings">
      <Section title="Text">
        <Choice<TextSizeLevel>
          label="Text size"
          value={settings.textSize}
          options={TEXT_SIZE_LEVELS.map((level) => ({ value: level, label: TEXT_SIZE_LABELS[level] }))}
          onChange={(textSize) => updateSettings({ textSize })}
        />
        <View style={[styles.preview, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <AppText variant="muted">Preview</AppText>
          <AppText>This is how text looks. Buttons and titles grow with it.</AppText>
        </View>
        <Toggle
          label="High contrast"
          icon="contrast"
          value={settings.highContrast}
          hint="White and yellow on black, easier to see."
          onChange={(highContrast) => updateSettings({ highContrast })}
        />
      </Section>

      <Section title="Voice">
        <View style={styles.stepper}>
          <AppText>Speed: {describeRate(rate)}</AppText>
          <View style={styles.row}>
            <View style={styles.half}>
              <BigButton
                label="Slower"
                icon="remove-circle"
                variant="secondary"
                disabled={rate <= SPEECH_RATES[0]}
                onPress={() => updateSettings({ voiceRate: slowerRate(rate) })}
              />
            </View>
            <View style={styles.half}>
              <BigButton
                label="Faster"
                icon="add-circle"
                variant="secondary"
                disabled={rate >= SPEECH_RATES[SPEECH_RATES.length - 1]}
                onPress={() => updateSettings({ voiceRate: fasterRate(rate) })}
              />
            </View>
          </View>
        </View>
        <View style={styles.stepper}>
          <AppText>Pitch: {describePitch(pitch)}</AppText>
          <View style={styles.row}>
            <View style={styles.half}>
              <BigButton
                label="Lower"
                icon="arrow-down-circle"
                variant="secondary"
                disabled={pitch <= PITCHES[0]}
                onPress={() => updateSettings({ voicePitch: lowerPitch(pitch) })}
              />
            </View>
            <View style={styles.half}>
              <BigButton
                label="Higher"
                icon="arrow-up-circle"
                variant="secondary"
                disabled={pitch >= PITCHES[PITCHES.length - 1]}
                onPress={() => updateSettings({ voicePitch: higherPitch(pitch) })}
              />
            </View>
          </View>
        </View>
        <BigButton label="Test voice" icon="volume-high" hint="Says a sentence at this speed and pitch." onPress={testVoice} />
      </Section>

      <Section title="How SmartAssist answers">
        <Toggle
          label="Speak buttons"
          icon="chatbubble-ellipses"
          value={settings.speakButtons}
          hint="Says each button's name when you tap it."
          onChange={(speakButtons) => updateSettings({ speakButtons })}
        />
        <Toggle
          label="Vibration"
          icon="phone-portrait"
          value={settings.vibration}
          hint="A short buzz on every tap, and patterns for listening, done and errors."
          onChange={(vibration) => updateSettings({ vibration })}
        />
        <Toggle
          label="Quiet mode"
          icon="volume-mute"
          value={settings.quietMode}
          hint="No talking: vibration and large words on screen instead."
          onChange={(quietMode) => updateSettings({ quietMode })}
        />
        <Toggle
          label="Detailed replies"
          icon="list-circle"
          value={settings.detailedReplies}
          hint="Replies also say what you can do next."
          onChange={(detailedReplies) => updateSettings({ detailedReplies })}
        />
        <Choice
          label="Directions in Find"
          value={settings.directions}
          options={[
            { value: 'leftRight', label: 'Left and right' },
            { value: 'clock', label: 'Clock face' },
          ]}
          onChange={(directions) => updateSettings({ directions })}
        />
      </Section>

      <Section title="More">
        <BigButton label="Practice" icon="school" variant="secondary" onPress={() => router.push('/practice')} />
        <BigButton label="Emergency Contacts" icon="call" variant="secondary" onPress={() => router.push('/emergency-contacts')} />
        <BigButton label="About" icon="information-circle" variant="secondary" onPress={() => router.push('/about')} />
        {confirmReset ? (
          <View style={[styles.preview, { borderColor: colors.danger, backgroundColor: colors.surface }]} accessibilityLiveRegion="polite">
            <AppText variant="button">Put every setting back to how it started?</AppText>
            <View style={styles.row}>
              <View style={styles.half}>
                <BigButton label="Yes, reset" icon="refresh" variant="danger" onPress={reset} />
              </View>
              <View style={styles.half}>
                <BigButton label="No" icon="close" variant="secondary" onPress={() => setConfirmReset(false)} />
              </View>
            </View>
          </View>
        ) : (
          <BigButton label="Reset settings" icon="refresh" variant="secondary" hint="Asks first." onPress={() => setConfirmReset(true)} />
        )}
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { sizes } = useAppTheme();
  return (
    <View style={styles.section}>
      <AppText variant="title" style={{ fontSize: Math.round(sizes.title * 0.8), lineHeight: Math.round(sizes.title * 1.1) }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: TARGET_GAP,
    marginTop: 8,
  },
  preview: {
    borderWidth: BORDER_WIDTH,
    borderRadius: RADIUS,
    padding: 16,
    gap: 8,
  },
  stepper: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TARGET_GAP,
  },
  half: {
    flexGrow: 1,
    flexBasis: 140,
  },
});
