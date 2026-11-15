import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { MIC_SIZE } from '@/theme/layout';
import { useAppTheme } from '@/theme/ThemeContext';

/**
 * The large mic button fixed at the bottom of every screen.
 * Opens Voice Command, which starts listening straight away
 * (on Android, the screen reader's Listening card opens).
 */
export function MicButton() {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voice command"
      accessibilityHint="Listens for a voice command."
      onPress={() => router.push({ pathname: '/voice-command', params: { listen: String(Date.now()) } })}
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
