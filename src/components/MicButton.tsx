import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { MIC_SIZE } from '@/theme/layout';
import { useAppTheme } from '@/theme/ThemeContext';

/**
 * The large mic button fixed at the bottom of every screen.
 *
 * PHASE 4 TASK (The Revenant): for now it only opens the Voice Command
 * screen. In phase 4 it should start listening straight away, with the
 * pulsing ring, rising tone and vibration from the design rules.
 */
export function MicButton() {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voice command"
      accessibilityHint="Opens voice commands so you can speak to the app."
      onPress={() => router.push('/voice-command')}
      style={({ pressed }) => [
        styles.mic,
        {
          backgroundColor: colors.primary,
          borderColor: colors.background,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <Ionicons name="mic" size={48} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mic: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
