/**
 * The words for the "Read My Screen" setup guide. Owner: Kosisochukwu.
 *
 * Each step is shown alone, in big text, and read aloud, so an older user
 * only has to do one thing at a time. Change the wording here; the screen
 * (src/app/screen-reading.tsx) picks it up.
 */

/** Android: switch on SmartAssist's own screen reader. */
export const ANDROID_STEPS = [
  'Tap Open Settings below. Your phone’s Accessibility settings will open.',
  'Scroll down and tap SmartAssist. It may be under Downloaded apps or Installed apps.',
  'Switch on Use SmartAssist, then tap Allow. Your phone will warn that SmartAssist can see your screen. That is how it reads it to you.',
  'Press Back until you are in SmartAssist again. It will tell you when screen reading is on.',
];

/** Shown under the Android steps, for phones that block the switch at first. */
export const ANDROID_RESTRICTED_TIP =
  'If your phone says “Restricted setting”: open Settings, tap Apps, tap SmartAssist, tap the three dots at the top right, then tap Allow restricted settings. Then try again.';

/** Android, once it is on: how to use it. */
export const ANDROID_HOW_TO_USE =
  'Screen reading is on. In any app, tap the yellow Read screen button. While it reads, you can tap Pause, Next or Stop. If the button is in the way, drag it somewhere else. It hides itself while SmartAssist is open.';

/**
 * iPhone: Apple does not let apps see other apps’ screens, so SmartAssist
 * helps the user turn on Apple’s own Speak Screen and its floating button.
 */
export const IPHONE_STEPS = [
  'Leave SmartAssist and open the Settings app. It is the grey gear.',
  'Tap Accessibility, then tap Spoken Content.',
  'Switch on Speak Screen.',
  'Tap Speech Controller and switch it on. This puts a small button on your screen.',
  'You are ready. In any app, tap the small button, then tap Play to hear the screen. You can also swipe down from the top of the screen with two fingers.',
];

/** Shown in Expo Go or the web preview, where the screen reader is missing. */
export const UNAVAILABLE_MESSAGE =
  'Screen reading needs the full SmartAssist app on an Android phone. This test version cannot read other apps.';
