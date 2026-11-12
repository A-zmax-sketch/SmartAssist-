import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BORDER_WIDTH, MIN_TOUCH, RADIUS } from '@/theme/layout';
import { useAppTheme } from '@/theme/ThemeContext';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  /** The word on the button. Screen readers say this too. */
  label: string;
  /** Every button has an icon and a word (design rule 2). Browse names at https://icons.expo.fyi */
  icon: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  /** Extra sentence for screen readers, e.g. "Reads your text aloud." */
  hint?: string;
  disabled?: boolean;
};

export function BigButton({ label, icon, onPress, variant = 'primary', hint, disabled }: Props) {
  const { colors, sizes } = useAppTheme();

  const background =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.surface;
  const foreground =
    variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.onDanger : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? colors.border : background,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}>
      <Ionicons name={icon} size={sizes.button + 6} color={foreground} />
      <AppText variant="button" color={foreground} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    borderRadius: RADIUS,
    borderWidth: BORDER_WIDTH,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    flexShrink: 1,
  },
});
