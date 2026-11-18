import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { Choice } from '@/components/Choice';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/services/feedback';
import { stopSpeaking } from '@/services/speech';
import { BORDER_WIDTH, RADIUS } from '@/theme/layout';
import { TEXT_SIZE_LABELS, TEXT_SIZE_LEVELS, type TextSizeLevel } from '@/theme/typography';
import { useAppTheme } from '@/theme/ThemeContext';

import { askForMicrophone } from '../../modules/screen-reader';

export const WELCOME_INTRO =
  'Welcome to SmartAssist. I read text aloud, help you find printed signs, and do what you say. ' +
  'Pick a text size you can read easily, allow the microphone so I can hear you, then press Continue.';

const MIC_RESULT = {
  granted: 'Microphone allowed. Tap the big microphone button on any screen and speak.',
  denied: 'The microphone wasn’t allowed. You can still type commands, or allow it later in your phone’s Settings.',
  unavailable: 'This test version can’t use the microphone. You can type commands instead.',
};

/**
 * Welcome: shown on first launch only. Owner: Kosisochukwu.
 *
 * Speaks a short introduction straight away (blind users can't read it),
 * lets the user pick a text size with a live preview, asks for the
 * microphone, and Continue goes Home. Never shown again after Continue.
 */
export default function WelcomeScreen() {
  const { colors, settings, updateSettings } = useAppTheme();
  const feedback = useFeedback();
  const [mic, setMic] = useState<keyof typeof MIC_RESULT | null>(null);

  // Say the introduction once, when the screen opens; stop if the user moves on.
  const { say } = feedback;
  useEffect(() => {
    void say(WELCOME_INTRO);
    return () => void stopSpeaking();
  }, [say]);

  const allowMicrophone = async () => {
    const result = await askForMicrophone();
    setMic(result);
    void feedback.say(MIC_RESULT[result], result === 'granted' ? 'done' : 'notUnderstood');
  };

  const finish = () => {
    updateSettings({ hasSeenWelcome: true });
    router.replace('/');
  };

  return (
    <Screen title="Welcome to SmartAssist" showBack={false} showMic={false}>
      <AppText>
        SmartAssist reads text aloud, finds printed signs, and does what you say. Use the big buttons, or tap the
        microphone and speak.
      </AppText>

      <BigButton
        label="Hear this again"
        icon="volume-high"
        variant="secondary"
        onPress={() => void feedback.say(WELCOME_INTRO)}
      />

      <Choice<TextSizeLevel>
        label="Text size"
        value={settings.textSize}
        options={TEXT_SIZE_LEVELS.map((level) => ({ value: level, label: TEXT_SIZE_LABELS[level] }))}
        onChange={(textSize) => updateSettings({ textSize })}
      />
      <View style={[styles.preview, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <AppText variant="muted">Preview</AppText>
        <AppText>Is this easy to read? You can change it any time in Settings, or say “bigger text”.</AppText>
      </View>

      {mic !== 'granted' && (
        <BigButton
          label="Allow microphone"
          icon="mic"
          hint="Lets SmartAssist hear your voice commands."
          onPress={() => void allowMicrophone()}
        />
      )}
      {mic && (
        <AppText accessibilityLiveRegion="polite" color={mic === 'granted' ? colors.text : colors.textMuted}>
          {MIC_RESULT[mic]}
        </AppText>
      )}

      <BigButton
        label="Continue"
        icon="arrow-forward"
        variant={mic === 'granted' ? 'primary' : 'secondary'}
        hint="Goes to the Home screen."
        onPress={finish}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    borderWidth: BORDER_WIDTH,
    borderRadius: RADIUS,
    padding: 16,
    gap: 8,
  },
});
