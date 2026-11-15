import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { router, Stack, usePathname, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';

import { AppThemeProvider, useAppTheme } from '@/theme/ThemeContext';

import {
  type LaunchAction,
  resumeHeySmartAssist,
  setScreenReaderVoice,
  useLaunchActions,
} from '../../modules/screen-reader';

// Keep the splash screen up until the font and saved settings are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });

  // If the font fails to load, carry on with the phone's default font.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AppThemeProvider>
      <AppStack />
    </AppThemeProvider>
  );
}

function AppStack() {
  const { colors, settings, ready } = useAppTheme();

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // The Android screen reader runs outside the app, so give it the voice
  // speed and pitch from Settings whenever they change. Does nothing elsewhere.
  useEffect(() => {
    setScreenReaderVoice(settings.voiceRate, settings.voicePitch);
  }, [settings.voiceRate, settings.voicePitch]);

  // If the user had "Hey SmartAssist" on before the phone restarted, turn it back on.
  useEffect(() => {
    resumeHeySmartAssist();
  }, []);

  // iPhone: "Hey Siri, talk to SmartAssist", the Action Button or a shortcut
  // opened the app with a job. The time makes each request new, so the
  // screen reacts even if it is already open.
  const openForLaunch = useCallback((action: LaunchAction) => {
    const now = String(Date.now());
    if (action === 'listen') {
      router.navigate({ pathname: '/voice-command', params: { listen: now } });
    } else if (action === 'readCopied') {
      router.navigate({ pathname: '/read-aloud', params: { read: now } });
    } else {
      router.navigate('/read-aloud');
    }
  }, []);
  // Wait until navigation is ready and, on first use, until Home has sent the
  // user to Welcome: that redirect replaces whatever screen is on top.
  const navigationReady = useRootNavigationState()?.key != null;
  const pathname = usePathname();
  const startScreenSettled = settings.hasSeenWelcome || pathname !== '/';
  useLaunchActions(openForLaunch, ready && navigationReady && startScreenSettled);

  if (!ready) {
    return null;
  }

  return (
    <>
      <StatusBar style={settings.highContrast ? 'light' : 'dark'} />
      {/* Each screen draws its own big header, so the built-in one is hidden. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </>
  );
}
