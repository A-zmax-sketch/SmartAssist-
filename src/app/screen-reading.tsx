import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import {
  ANDROID_HOW_TO_USE,
  ANDROID_RESTRICTED_TIP,
  ANDROID_STEPS,
  HEY_SMARTASSIST_FAILED,
  HEY_SMARTASSIST_INFO,
  IPHONE_ACTION_BUTTON_STEPS,
  IPHONE_BACK_TAP_INFO,
  IPHONE_BACK_TAP_STEPS,
  IPHONE_HOW_TO_USE,
  IPHONE_SIRI_TIP,
  IPHONE_STEPS,
  IPHONE_VOICE_HOW_TO_USE,
  UNAVAILABLE_MESSAGE,
  VOICE_HOW_TO_USE,
} from '@/services/screenReadingGuide';
import { speak, stopSpeaking } from '@/services/speech';
import { BORDER_WIDTH, RADIUS, TARGET_GAP } from '@/theme/layout';
import { useAppTheme } from '@/theme/ThemeContext';

import {
  openScreenReaderSettings,
  screenReaderAvailable,
  useHeySmartAssist,
  useScreenReaderOn,
} from '../../modules/screen-reader';

/** Which step-by-step guide is showing: the main one, or an iPhone extra. */
type Guide = 'main' | 'backTap' | 'actionButton';

/**
 * Read My Screen: sets up reading other apps' screens. Owner: Kosisochukwu.
 *
 * Android: a guide to switch on SmartAssist's screen reader, then how to use
 * it, with voice commands and "Hey SmartAssist".
 * iPhone: Apple doesn't let apps read other apps, so a guide to switch on
 * Apple's Speak Screen. Once it is on: how to use it, Back Tap (tap the back
 * of the phone to read), and voice commands through Siri or the Action Button.
 * Each step is shown alone and read aloud.
 */
export default function ScreenReadingScreen() {
  const { colors, settings } = useAppTheme();
  const isIphone = Platform.OS === 'ios';
  const [guide, setGuide] = useState<Guide>('main');
  const [step, setStep] = useState(0);
  const { isOn } = useScreenReaderOn();
  const hey = useHeySmartAssist();
  const [heyNotice, setHeyNotice] = useState('');

  const steps =
    guide === 'backTap'
      ? IPHONE_BACK_TAP_STEPS
      : guide === 'actionButton'
        ? IPHONE_ACTION_BUTTON_STEPS
        : isIphone
          ? IPHONE_STEPS
          : ANDROID_STEPS;
  const howToUse = isIphone ? IPHONE_HOW_TO_USE : ANDROID_HOW_TO_USE;

  const say = useCallback(
    (text: string) => void speak(text, { rate: settings.voiceRate, pitch: settings.voicePitch }),
    [settings.voiceRate, settings.voicePitch],
  );

  // Coming back from the phone's Settings with it now on: say how to use it.
  const wasOn = useRef(isOn);
  useEffect(() => {
    if (isOn && !wasOn.current) {
      say(howToUse);
    }
    wasOn.current = isOn;
  }, [isOn, say, howToUse]);

  // Stop talking when the user leaves this screen.
  useFocusEffect(useCallback(() => () => void stopSpeaking(), []));

  const showStep = (index: number) => {
    setStep(index);
    say(steps[index]);
  };

  const openGuide = (next: Guide) => {
    setGuide(next);
    setStep(0);
    if (next === 'backTap') say(IPHONE_BACK_TAP_STEPS[0]);
    if (next === 'actionButton') say(IPHONE_ACTION_BUTTON_STEPS[0]);
  };

  if (!isIphone && !screenReaderAvailable) {
    return (
      <Screen title="Read My Screen">
        <AppText>{UNAVAILABLE_MESSAGE}</AppText>
      </Screen>
    );
  }

  if (isIphone && isOn && guide === 'main') {
    return (
      <Screen title="Read My Screen">
        <AppText>{IPHONE_HOW_TO_USE}</AppText>
        <BigButton
          label="Read this aloud"
          icon="volume-high"
          onPress={() => say(`${IPHONE_HOW_TO_USE} ${IPHONE_VOICE_HOW_TO_USE}`)}
        />

        <View style={[styles.box, styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <AppText variant="button">Read with a double tap</AppText>
          <AppText>{IPHONE_BACK_TAP_INFO}</AppText>
          <BigButton
            label="Set up Back Tap"
            icon="phone-portrait"
            hint="Shows the steps, one at a time, and reads them aloud."
            onPress={() => openGuide('backTap')}
          />
        </View>

        <View style={[styles.box, styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <AppText variant="button">Voice commands</AppText>
          <AppText>{IPHONE_VOICE_HOW_TO_USE}</AppText>
          <BigButton label="Try a voice command" icon="mic" onPress={() => router.push('/voice-command')} />
          <BigButton
            label="Set up the Action Button"
            icon="radio-button-on"
            variant="secondary"
            hint="Press and hold the Action Button to talk to SmartAssist."
            onPress={() => openGuide('actionButton')}
          />
          <AppText variant="muted">{IPHONE_SIRI_TIP}</AppText>
        </View>
      </Screen>
    );
  }

  if (!isIphone && isOn) {
    const toggleHeySmartAssist = async () => {
      if (hey.isOn) {
        hey.turnOff();
        setHeyNotice('');
      } else {
        setHeyNotice((await hey.turnOn()) ? '' : HEY_SMARTASSIST_FAILED);
      }
    };

    return (
      <Screen title="Read My Screen">
        <AppText>{ANDROID_HOW_TO_USE}</AppText>
        <BigButton
          label="Read this aloud"
          icon="volume-high"
          onPress={() => say(`${ANDROID_HOW_TO_USE} ${VOICE_HOW_TO_USE}`)}
        />

        <View style={[styles.box, styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <AppText variant="button">Voice commands</AppText>
          <AppText>{VOICE_HOW_TO_USE}</AppText>
          <AppText>{HEY_SMARTASSIST_INFO}</AppText>
          <BigButton
            label={hey.isOn ? 'Turn off “Hey SmartAssist”' : 'Turn on “Hey SmartAssist”'}
            icon={hey.isOn ? 'mic-off' : 'mic'}
            variant={hey.isOn ? 'secondary' : 'primary'}
            hint={hey.isOn ? 'SmartAssist stops listening all the time.' : 'SmartAssist listens all the time for “Hey SmartAssist”.'}
            onPress={toggleHeySmartAssist}
          />
          {heyNotice !== '' && (
            <AppText color={colors.danger} accessibilityLiveRegion="polite">
              {heyNotice}
            </AppText>
          )}
        </View>

        <BigButton
          label="Turn off screen reading"
          icon="settings"
          variant="secondary"
          hint="Opens your phone's Accessibility settings."
          onPress={openScreenReaderSettings}
        />
      </Screen>
    );
  }

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const isExtraGuide = guide !== 'main';

  return (
    <Screen title="Read My Screen">
      <AppText variant="muted">
        Step {step + 1} of {steps.length}
      </AppText>
      <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <AppText accessibilityLiveRegion="polite">{steps[step]}</AppText>
      </View>

      {!isIphone && isFirst && (
        <BigButton
          label="Open Settings"
          icon="settings"
          hint="Opens your phone's Accessibility settings."
          onPress={openScreenReaderSettings}
        />
      )}
      {!isLast && (
        <BigButton
          label="Next step"
          icon="arrow-forward"
          variant={!isIphone && isFirst ? 'secondary' : 'primary'}
          onPress={() => showStep(step + 1)}
        />
      )}
      {isLast && isExtraGuide && (
        <BigButton label="Done" icon="checkmark-circle" onPress={() => openGuide('main')} />
      )}
      {!isFirst && (
        <BigButton label="Previous step" icon="arrow-back" variant="secondary" onPress={() => showStep(step - 1)} />
      )}
      <BigButton label="Read step again" icon="volume-high" variant="secondary" onPress={() => say(steps[step])} />

      {!isIphone && <AppText variant="muted">{ANDROID_RESTRICTED_TIP}</AppText>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: BORDER_WIDTH,
    borderRadius: RADIUS,
    padding: 16,
  },
  section: {
    gap: TARGET_GAP,
  },
});
