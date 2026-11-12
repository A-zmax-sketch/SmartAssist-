import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MicButton } from '@/components/MicButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { MIC_SIZE, SCREEN_PADDING, TARGET_GAP } from '@/theme/layout';
import { useAppTheme } from '@/theme/ThemeContext';

type Props = {
  title: string;
  children?: ReactNode;
  showBack?: boolean;
  /** The mic button shows on every screen except Voice Command itself. */
  showMic?: boolean;
};

/**
 * The frame every screen sits in: theme background, header with Back,
 * scrolling content (so huge text never gets cut off) and the mic button.
 */
export function Screen({ title, children, showBack = true, showMic = true }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (showMic ? MIC_SIZE + TARGET_GAP * 2 : SCREEN_PADDING) + insets.bottom },
        ]}>
        <ScreenHeader title={title} showBack={showBack} />
        {children}
      </ScrollView>
      {showMic && (
        <View style={[styles.mic, { bottom: insets.bottom + TARGET_GAP }]}>
          <MicButton />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: SCREEN_PADDING,
    gap: TARGET_GAP,
  },
  mic: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
