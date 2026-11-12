import { router, useCanGoBack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';

type Props = {
  title: string;
  /** Show the Back button. Home turns this off. */
  showBack?: boolean;
};

/** Back button (when there is somewhere to go back to) and the screen title. */
export function ScreenHeader({ title, showBack = true }: Props) {
  const canGoBack = useCanGoBack();

  return (
    <View style={styles.header}>
      {showBack && (
        <View style={styles.back}>
          {canGoBack ? (
            <BigButton label="Back" icon="arrow-back" variant="secondary" onPress={() => router.back()} />
          ) : (
            <BigButton label="Home" icon="home" variant="secondary" onPress={() => router.replace('/')} />
          )}
        </View>
      )}
      <AppText variant="title">{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 16,
  },
  back: {
    alignSelf: 'flex-start',
  },
});
