import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { Tile } from '@/components/Tile';
import { TARGET_GAP } from '@/theme/layout';
import { useAppTheme } from '@/theme/ThemeContext';

/**
 * Home: four big tiles plus a Help link. Owner: Kachi.
 * The 2 x 2 grid becomes one column at Extra large and Huge text.
 */
export default function HomeScreen() {
  const { settings } = useAppTheme();

  if (!settings.hasSeenWelcome) {
    return <Redirect href="/welcome" />;
  }

  const oneColumn = settings.textSize === 'extraLarge' || settings.textSize === 'huge';
  const rowStyle = oneColumn ? styles.column : styles.row;

  return (
    <Screen title="SmartAssist" showBack={false}>
      <AppText variant="muted">What would you like to do?</AppText>

      <View style={styles.grid}>
        <View style={rowStyle}>
          <Tile
            label="Find"
            icon="scan"
            hint="Find and read a printed sign with the camera."
            onPress={() => router.push('/find')}
          />
          <Tile
            label="Read Aloud"
            icon="volume-high"
            hint="Type or paste text and hear it read aloud."
            onPress={() => router.push('/read-aloud')}
          />
        </View>
        <View style={rowStyle}>
          <Tile
            label="Routines"
            icon="list"
            hint="Step-by-step routines read one step at a time."
            onPress={() => router.push('/routines')}
          />
          <Tile
            label="Settings"
            icon="settings"
            hint="Change text size, contrast and voice."
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>

      <BigButton
        label="Help: what can I say?"
        icon="help-circle"
        variant="secondary"
        onPress={() => router.push('/help')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: TARGET_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: TARGET_GAP,
  },
  column: {
    flexDirection: 'column',
    gap: TARGET_GAP,
  },
});
