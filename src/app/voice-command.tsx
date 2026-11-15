import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { BORDER_WIDTH, RADIUS, TARGET_GAP } from '@/theme/layout';
import { LINE_HEIGHT } from '@/theme/typography';
import { useAppTheme } from '@/theme/ThemeContext';

import { carryOutCommand, listenForCommand, useScreenReaderOn } from '../../modules/screen-reader';

export const VOICE_INTRO = 'Tap Speak and say what you want, like “Open WhatsApp” or “What time is it?”.';
export const VOICE_SAFETY = 'SmartAssist always asks you before it sends a message or makes a call.';
export const TYPE_ONLY_NOTE =
  'This test version can’t hear you. Type your command below, or tap the microphone on the keyboard and say it.';
export const ANDROID_NEEDS_READER =
  'On Android, voice commands work through screen reading, so they also work in other apps. Turn on screen reading first.';

/**
 * Voice Command: say (or type) a command and SmartAssist does it.
 * Owner: Kosisochukwu (phase 4).
 *
 * iPhone: listens here, shows the words as they are heard, asks before
 * sending or calling with big Yes and No buttons, and says what it did.
 * Android: the same commands run through the screen reader's Listening card,
 * which also works on top of other apps.
 * Opened with ?listen=… (the mic button, "Hey Siri, talk to SmartAssist"),
 * it starts listening straight away.
 */
export default function VoiceCommandScreen() {
  const { listen, command } = useLocalSearchParams<{ listen?: string; command?: string }>();
  return Platform.OS === 'android' ? (
    <AndroidVoiceCommand listen={listen} />
  ) : (
    <AssistantVoiceCommand listen={listen} command={command} />
  );
}

function AssistantVoiceCommand({ listen, command }: { listen?: string; command?: string }) {
  const { colors } = useAppTheme();
  const assistant = useVoiceAssistant();
  const { phase, heard, said, question, canListen } = assistant;
  const startListening = assistant.listen;

  // Opened by the mic button or Siri: start listening at once.
  useEffect(() => {
    if (listen && canListen) void startListening();
  }, [listen, canListen, startListening]);

  // Testing without a microphone (development builds only):
  // xcrun simctl openurl booted "smartassist://voice-command?command=what%20time%20is%20it"
  const { typed } = assistant;
  useEffect(() => {
    if (__DEV__ && command) void typed(command);
  }, [command, typed]);

  // Leaving the screen stops listening and talking.
  const { cancel } = assistant;
  useFocusEffect(useCallback(() => cancel, [cancel]));

  const idle = phase === 'idle';

  return (
    <Screen title="Voice Command" showMic={false}>
      <View
        style={[styles.card, { borderColor: phase === 'listening' ? colors.primary : colors.border, backgroundColor: colors.surface }]}
        accessibilityLiveRegion="polite">
        {phase === 'listening' && (
          <>
            <AppText variant="title" color={colors.primary}>
              Listening…
            </AppText>
            <AppText variant="button">{heard || 'Say your command now.'}</AppText>
          </>
        )}

        {phase === 'asking' && question && (
          <>
            <AppText variant="button">{question}</AppText>
            {heard !== '' && <AppText variant="muted">You said: {heard}</AppText>}
          </>
        )}

        {(phase === 'working' || phase === 'idle') && (heard !== '' || said !== '') && (
          <>
            {heard !== '' && <AppText variant="muted">You said: “{heard}”</AppText>}
            {said !== '' && <AppText variant="button">{said}</AppText>}
          </>
        )}

        {idle && heard === '' && said === '' && (
          <>
            <AppText>{canListen ? VOICE_INTRO : TYPE_ONLY_NOTE}</AppText>
            <AppText variant="muted">{VOICE_SAFETY}</AppText>
          </>
        )}
      </View>

      {phase === 'asking' && (
        <View style={styles.row}>
          <View style={styles.half}>
            <BigButton label="Yes" icon="checkmark-circle" hint="Goes ahead." onPress={() => assistant.answer(true)} />
          </View>
          <View style={styles.half}>
            <BigButton label="No" icon="close-circle" variant="danger" hint="Stops. Nothing is sent." onPress={() => assistant.answer(false)} />
          </View>
        </View>
      )}

      {phase === 'listening' && (
        <View style={styles.row}>
          <View style={styles.half}>
            <BigButton label="I’ve finished" icon="checkmark" hint="Stops listening and does what you said." onPress={assistant.finishTalking} />
          </View>
          <View style={styles.half}>
            <BigButton label="Cancel" icon="close" variant="secondary" onPress={assistant.cancel} />
          </View>
        </View>
      )}

      {idle && canListen && (
        <BigButton
          label={said ? 'Speak again' : 'Speak'}
          icon="mic"
          hint="Listens for your command. Stop talking when you have finished."
          onPress={() => void startListening()}
        />
      )}

      {(idle || phase === 'working') && <TypedCommand disabled={!idle} onSubmit={assistant.typed} />}

      {idle && (
        <>
          <BigButton label="What can I say?" icon="help-circle" variant="secondary" onPress={() => void assistant.typed('help')} />
          <BigButton label="Command History" icon="time" variant="secondary" onPress={() => router.push('/history')} />
        </>
      )}
    </Screen>
  );
}

function AndroidVoiceCommand({ listen }: { listen?: string }) {
  const { colors } = useAppTheme();
  const { isOn, recheck } = useScreenReaderOn();
  useFocusEffect(recheck);
  const [notice, setNotice] = useState('');

  const speakNow = useCallback(() => {
    setNotice(listenForCommand() ? '' : ANDROID_NEEDS_READER);
  }, []);

  // Opened by the mic button: open the Listening card at once. If screen
  // reading is off, the screen already explains how to turn it on.
  useEffect(() => {
    if (listen) listenForCommand();
  }, [listen]);

  return (
    <Screen title="Voice Command" showMic={false}>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <AppText>{isOn ? VOICE_INTRO : ANDROID_NEEDS_READER}</AppText>
        <AppText variant="muted">{VOICE_SAFETY}</AppText>
      </View>
      {isOn ? (
        <>
          <BigButton label="Speak" icon="mic" hint="Opens the Listening card. Say your command." onPress={speakNow} />
          <TypedCommand
            onSubmit={(words) => setNotice(carryOutCommand(words) ? '' : ANDROID_NEEDS_READER)}
          />
        </>
      ) : (
        <BigButton
          label="Set up screen reading"
          icon="phone-portrait"
          hint="Shows the steps, one at a time, and reads them aloud."
          onPress={() => router.push('/screen-reading')}
        />
      )}
      {notice !== '' && (
        <AppText color={colors.danger} accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      )}
      <BigButton label="Command History" icon="time" variant="secondary" onPress={() => router.push('/history')} />
    </Screen>
  );
}

/** A box to type (or dictate with the keyboard's microphone) a command. */
function TypedCommand({ onSubmit, disabled }: { onSubmit: (words: string) => void; disabled?: boolean }) {
  const { colors, sizes, fonts } = useAppTheme();
  const [words, setWords] = useState('');

  const submit = () => {
    if (!words.trim()) return;
    onSubmit(words);
    setWords('');
  };

  return (
    <View style={styles.typed}>
      <AppText>Or type a command:</AppText>
      <TextInput
        value={words}
        onChangeText={setWords}
        onSubmitEditing={submit}
        editable={!disabled}
        returnKeyType="go"
        placeholder="For example: what time is it"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Type a command"
        style={[
          styles.input,
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
        label="Do it"
        icon="arrow-forward-circle"
        variant="secondary"
        hint="Carries out the command you typed."
        disabled={disabled || !words.trim()}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: BORDER_WIDTH * 2,
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
  typed: {
    gap: 12,
  },
  input: {
    minHeight: 64,
    borderWidth: BORDER_WIDTH,
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
