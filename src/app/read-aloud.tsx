import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { useReadAloud } from '@/hooks/useReadAloud';
import { describeRate, fasterRate, SPEECH_RATES, slowerRate } from '@/services/speech';
import { BORDER_WIDTH, RADIUS, TARGET_GAP } from '@/theme/layout';
import { LINE_HEIGHT } from '@/theme/typography';
import { useAppTheme } from '@/theme/ThemeContext';

/**
 * Read Aloud: type or paste text and hear it. Owner: Kosisochukwu.
 *
 * Main actions (at most 4): Paste, Play/Pause, Stop, Replay.
 * Smaller controls: speed (Slower / Faster) and a link to Saved Texts.
 * The Save button arrives in phase 5, with the saved-texts storage.
 */
export default function ReadAloudScreen() {
  const { colors, sizes, fonts, settings, updateSettings } = useAppTheme();
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const reader = useReadAloud(text);
  const { pause } = reader;

  // Opening another screen on top (Help, the mic button...) pauses reading,
  // so the user can come back and press Play to carry on.
  useFocusEffect(useCallback(() => pause, [pause]));

  const hasText = text.trim().length > 0;
  const playing = reader.status === 'playing';

  const changeText = (newText: string) => {
    reader.stop(); // the old sentences no longer match the box
    setNotice('');
    setText(newText);
  };

  const paste = async () => {
    // On the web the browser may refuse; treat that like an empty clipboard.
    const copied = await Clipboard.getStringAsync().catch(() => '');
    if (copied.trim().length === 0) {
      setNotice('Nothing to paste. Copy some text in another app first.');
      return;
    }
    // Add to what is already there rather than throwing the user's typing away.
    changeText(hasText ? `${text}\n\n${copied}` : copied);
    setNotice('Text pasted. Press Play to hear it.');
  };

  const rate = settings.voiceRate;
  const slowest = rate <= SPEECH_RATES[0];
  const fastest = rate >= SPEECH_RATES[SPEECH_RATES.length - 1];

  return (
    <Screen title="Read Aloud">
      <AppText>Type or paste the text you want to hear.</AppText>
      <TextInput
        value={text}
        onChangeText={changeText}
        multiline
        placeholder="Your text goes here"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Text to read aloud"
        textAlignVertical="top"
        style={[
          styles.textBox,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            fontFamily: fonts.regular,
            fontSize: sizes.body,
            lineHeight: Math.round(sizes.body * LINE_HEIGHT),
          },
        ]}
      />

      <BigButton
        label="Paste"
        icon="clipboard"
        variant="secondary"
        hint="Adds the text you copied into the box."
        onPress={paste}
      />

      {playing ? (
        <BigButton label="Pause" icon="pause" hint="Pauses reading. Press Play to carry on." onPress={pause} />
      ) : (
        <BigButton
          label={reader.status === 'paused' ? 'Play from where I stopped' : 'Play'}
          icon="play"
          hint="Reads your text aloud."
          disabled={!hasText}
          onPress={reader.play}
        />
      )}

      <View style={styles.row}>
        <View style={styles.half}>
          <BigButton
            label="Stop"
            icon="stop"
            variant="danger"
            hint="Stops reading and goes back to the start."
            disabled={reader.status === 'idle'}
            onPress={reader.stop}
          />
        </View>
        <View style={styles.half}>
          <BigButton
            label="Replay"
            icon="refresh"
            variant="secondary"
            hint="Reads your text again from the beginning."
            disabled={!hasText}
            onPress={reader.replay}
          />
        </View>
      </View>

      {reader.status !== 'idle' && (
        <AppText variant="muted">
          {playing ? 'Reading' : 'Paused at'} sentence {reader.sentenceIndex + 1} of {reader.sentenceCount}.
        </AppText>
      )}
      {reader.failed && (
        <AppText color={colors.danger} accessibilityLiveRegion="polite">
          Sorry, the voice could not start. Check your phone is not on silent, then try again.
        </AppText>
      )}
      {notice !== '' && (
        <AppText variant="muted" accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      )}

      <View style={[styles.speedBox, { borderColor: colors.border }]}>
        <AppText>Speed: {describeRate(rate)}</AppText>
        <View style={styles.row}>
          <View style={styles.half}>
            <BigButton
              label="Slower"
              icon="remove-circle"
              variant="secondary"
              hint={`Makes the voice slower. Now: ${describeRate(rate)}.`}
              disabled={slowest}
              onPress={() => updateSettings({ voiceRate: slowerRate(rate) })}
            />
          </View>
          <View style={styles.half}>
            <BigButton
              label="Faster"
              icon="add-circle"
              variant="secondary"
              hint={`Makes the voice faster. Now: ${describeRate(rate)}.`}
              disabled={fastest}
              onPress={() => updateSettings({ voiceRate: fasterRate(rate) })}
            />
          </View>
        </View>
      </View>

      <BigButton
        label="Saved Texts"
        icon="bookmark"
        variant="secondary"
        hint="Opens texts you saved earlier."
        onPress={() => router.push('/saved-texts')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  textBox: {
    minHeight: 200,
    borderWidth: BORDER_WIDTH,
    borderRadius: RADIUS,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TARGET_GAP,
  },
  half: {
    flexGrow: 1,
    flexBasis: 200,
  },
  speedBox: {
    borderWidth: BORDER_WIDTH,
    borderRadius: RADIUS,
    padding: 16,
    gap: TARGET_GAP,
  },
});
