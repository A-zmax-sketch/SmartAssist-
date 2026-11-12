import { Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/theme/ThemeContext';
import { LINE_HEIGHT } from '@/theme/typography';

type Variant = 'body' | 'muted' | 'button' | 'title';

type Props = TextProps & {
  variant?: Variant;
  /** Override the text colour, for example on a coloured button. */
  color?: string;
};

/**
 * Use this instead of React Native's <Text> so every piece of text gets the
 * app font and follows the user's text size and theme.
 */
export function AppText({ variant = 'body', color, style, ...rest }: Props) {
  const { colors, sizes, fonts } = useAppTheme();

  const fontSize = variant === 'title' ? sizes.title : variant === 'button' ? sizes.button : sizes.body;
  const bold = variant === 'title' || variant === 'button';

  return (
    <Text
      accessibilityRole={variant === 'title' ? 'header' : undefined}
      style={[
        {
          fontFamily: bold ? fonts.bold : fonts.regular,
          fontSize,
          lineHeight: Math.round(fontSize * LINE_HEIGHT),
          color: color ?? (variant === 'muted' ? colors.textMuted : colors.text),
        },
        style,
      ]}
      {...rest}
    />
  );
}
