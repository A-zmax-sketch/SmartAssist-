import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { BORDER_WIDTH, RADIUS } from '@/theme/layout';
import { useAppTheme } from '@/theme/ThemeContext';

/**
 * Welcome: shown on first launch only. Owner: Kosisochukwu.
 *
 * PHASE 2-3 TASKS: final layout from the mock-up, a text-size preview,
 * the spoken introduction (expo-speech) and the "Allow microphone" button.
 */
export default function WelcomeScreen() {
  const { colors, updateSettings } = useAppTheme();

  const finish = () => {
    updateSettings({ hasSeenWelcome: true });
    router.replace('/');
  };

  return (
    <Screen title="Welcome to SmartAssist" showBack={false} showMic={false}>
      <AppText>
        SmartAssist reads text aloud, finds printed signs, and understands your voice. Use the big
        buttons, or tap the microphone and speak.
      </AppText>
      <View style={[styles.note, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <AppText variant="muted">
          Coming in phases 2 and 3: spoken introduction, microphone permission and a text-size preview.
        </AppText>
      </View>
      <BigButton label="Continue" icon="arrow-forward" onPress={finish} hint="Goes to the Home screen." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    borderWidth: BORDER_WIDTH,
    borderRadius: RADIUS,
    borderStyle: 'dashed',
    padding: 16,
  },
});
