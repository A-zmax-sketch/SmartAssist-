import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import type { IconName } from '@/components/BigButton';
import { BORDER_WIDTH, RADIUS, TILE_MIN_HEIGHT } from '@/theme/layout';
import { useAppTheme } from '@/theme/ThemeContext';

type Props = {
  label: string;
  icon: IconName;
  onPress: () => void;
  hint?: string;
};

/** One of the four big tiles on the Home screen. */
export function Tile({ label, icon, onPress, hint }: Props) {
  const { colors, sizes } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <Ionicons name={icon} size={sizes.title + 12} color={colors.primary} />
      <AppText variant="button" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: TILE_MIN_HEIGHT,
    borderRadius: RADIUS,
    borderWidth: BORDER_WIDTH,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    textAlign: 'center',
  },
});
