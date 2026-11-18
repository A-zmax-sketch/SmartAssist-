import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/services/feedback';
import { sendToScreen } from '@/services/screenRequests';
import { deleteSavedText, savedTexts, type SavedText } from '@/storage/savedTextsStore';
import { BORDER_WIDTH, RADIUS, TARGET_GAP } from '@/theme/layout';
import { useAppTheme } from '@/theme/ThemeContext';

export const NO_SAVED_TEXTS = 'No saved texts yet. In Read Aloud, type or paste some text and press Save.';

/**
 * Saved Texts: replay texts saved from Read Aloud. Owner: Kosisochukwu.
 * Each item shows its title and first line, with Play and Delete.
 * Play reads it in Read Aloud (with Pause, speed and Continue).
 * Delete can be undone, in case it was pressed by mistake.
 */
export default function SavedTextsScreen() {
  const { colors } = useAppTheme();
  const list = savedTexts.use();
  const feedback = useFeedback();
  const [deleted, setDeleted] = useState<{ item: SavedText; index: number } | null>(null);

  const play = (item: SavedText) => {
    sendToScreen('readAloud', 'load', item.text);
    router.dismissTo('/read-aloud');
  };

  const remove = async (item: SavedText) => {
    setDeleted({ item, index: list.indexOf(item) });
    await deleteSavedText(item.id);
    void feedback.say(`Deleted ${item.title}.`);
  };

  const undo = async () => {
    if (!deleted) return;
    const { item, index } = deleted;
    setDeleted(null);
    await savedTexts.update((now) => [...now.slice(0, index), item, ...now.slice(index)]);
    void feedback.say('Brought back.');
  };

  return (
    <Screen title="Saved Texts">
      {deleted && (
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]} accessibilityLiveRegion="polite">
          <AppText>Deleted “{deleted.item.title}”.</AppText>
          <BigButton label="Undo" icon="arrow-undo" variant="secondary" hint="Brings the text back." onPress={() => void undo()} />
        </View>
      )}

      {list.length === 0 ? (
        <>
          <AppText>{NO_SAVED_TEXTS}</AppText>
          <BigButton label="Go to Read Aloud" icon="volume-high" onPress={() => router.dismissTo('/read-aloud')} />
        </>
      ) : (
        <>
          <AppText variant="muted">
            {list.length === 1 ? '1 saved text' : `${list.length} saved texts`}, newest first.
          </AppText>
          {list.map((item) => (
            <View key={item.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <AppText variant="button">{item.title}</AppText>
              <AppText variant="muted">{preview(item.text)}</AppText>
              <View style={styles.row}>
                <View style={styles.half}>
                  <BigButton label="Play" spokenLabel={`Play ${item.title}`} icon="play" hint="Reads it aloud in Read Aloud." onPress={() => play(item)} />
                </View>
                <View style={styles.half}>
                  <BigButton
                    label="Delete"
                    spokenLabel={`Delete ${item.title}`}
                    icon="trash"
                    variant="danger"
                    hint="Removes it. You can undo straight after."
                    onPress={() => void remove(item)}
                  />
                </View>
              </View>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

/** The start of the text, cut at a word (never cut off by the layout, so big text still shows it all). */
export function preview(text: string, length = 100): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= length) return flat;
  const cut = flat.lastIndexOf(' ', length);
  return `${flat.slice(0, cut > 0 ? cut : length)}…`;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: BORDER_WIDTH,
    borderRadius: RADIUS,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TARGET_GAP,
  },
  half: {
    flexGrow: 1,
    flexBasis: 140,
  },
});
