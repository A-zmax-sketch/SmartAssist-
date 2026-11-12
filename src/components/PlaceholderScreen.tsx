import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BigButton, type IconName } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { BORDER_WIDTH, RADIUS } from '@/theme/layout';
import { useAppTheme } from '@/theme/ThemeContext';

type Props = {
  title: string;
  /** One sentence: what this screen is for. */
  purpose: string;
  /** When the real screen is built, e.g. "Phase 3". */
  phase: string;
  /** Who builds it. */
  owner: string;
  /** Screens you can reach from here, so every screen can be tested. */
  links?: { label: string; icon: IconName; href: Href }[];
  showMic?: boolean;
};

/**
 * A stand-in used until a screen's owner builds the real thing.
 * To build your screen: replace the <PlaceholderScreen ... /> in your file
 * under src/app with your own layout inside <Screen title="...">.
 */
export function PlaceholderScreen({ title, purpose, phase, owner, links = [], showMic = true }: Props) {
  const { colors } = useAppTheme();

  return (
    <Screen title={title} showMic={showMic}>
      <AppText>{purpose}</AppText>
      <View style={[styles.note, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <AppText variant="muted">
          Coming in {phase}. Built by {owner}.
        </AppText>
      </View>
      {links.map((link) => (
        <BigButton
          key={link.label}
          label={link.label}
          icon={link.icon}
          variant="secondary"
          onPress={() => router.push(link.href)}
        />
      ))}
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
