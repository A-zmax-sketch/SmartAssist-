import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '@/storage/settingsStore';
import { defaultColors, highContrastColors, type ColorTokens } from '@/theme/colors';
import { FONTS, TEXT_SIZES, type TextSizes } from '@/theme/typography';

type AppTheme = {
  /** Colours for the current theme (Default or High contrast). */
  colors: ColorTokens;
  /** Font sizes for the current text-size level. */
  sizes: TextSizes;
  fonts: typeof FONTS;
  settings: Settings;
  /** Change one or more settings, for example updateSettings({ highContrast: true }). */
  updateSettings: (changes: Partial<Settings>) => void;
  /** False until saved settings have been loaded. */
  ready: boolean;
};

const AppThemeContext = createContext<AppTheme | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .finally(() => setReady(true));
  }, []);

  const updateSettings = (changes: Partial<Settings>) => {
    const next = { ...settings, ...changes };
    setSettings(next);
    void saveSettings(next);
  };

  const value: AppTheme = {
    colors: settings.highContrast ? highContrastColors : defaultColors,
    sizes: TEXT_SIZES[settings.textSize],
    fonts: FONTS,
    settings,
    updateSettings,
    ready,
  };

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

/** Use inside any screen or component to get colours, sizes and settings. */
export function useAppTheme(): AppTheme {
  const theme = useContext(AppThemeContext);
  if (!theme) {
    throw new Error('useAppTheme must be used inside <AppThemeProvider>');
  }
  return theme;
}
