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

/** Android, once it is on: how to give voice commands. */
export const VOICE_HOW_TO_USE =
  'You can also talk to SmartAssist. Tap Speak on the yellow button and say a command, like “Open WhatsApp” or “Send a message to Mum saying I’m on my way”. SmartAssist always asks you before it sends a message or makes a call.';

/** Explains "Hey SmartAssist" before the user turns it on. */
export const HEY_SMARTASSIST_INFO =
  'Turn on “Hey SmartAssist” to give commands without touching the phone. Say “Hey SmartAssist”, then your command. SmartAssist then listens all the time. This uses more battery, and a notification shows while it listens.';

/** Shown if Android refused to start "Hey SmartAssist". */
export const HEY_SMARTASSIST_FAILED =
  'SmartAssist could not start listening. Check that it is allowed to use the microphone, then try again.';

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

/** iPhone, once Speak Screen is on: how to use it. */
export const IPHONE_HOW_TO_USE =
  'Speak Screen is on. In any app, swipe down from the very top of the screen with two fingers, and your iPhone reads everything on it. Or say “Hey Siri, speak screen”. While it reads, a small panel lets you pause, skip and change the speed.';

/** iPhone: what Back Tap does, before the user sets it up. */
export const IPHONE_BACK_TAP_INFO =
  'Two-finger swipes can be hard. Set up Back Tap, and tapping the back of your iPhone twice reads the screen instead.';

/** iPhone: set Back Tap to Speak Screen. */
export const IPHONE_BACK_TAP_STEPS = [
  'Leave SmartAssist and open the Settings app. Tap Accessibility, then tap Touch.',
  'Scroll to the bottom and tap Back Tap.',
  'Tap Double Tap. Then scroll down and tap Speak Screen.',
  'You are ready. In any app, tap the back of your iPhone twice, firmly, near the camera. Your iPhone reads the screen to you.',
];

/** iPhone: how to give voice commands from anywhere. */
export const IPHONE_VOICE_HOW_TO_USE =
  'You can talk to SmartAssist from anywhere. Say “Hey Siri, talk to SmartAssist”, then your command, like “Send a message to Mum saying I’m on my way”. SmartAssist always asks you before it sends a message or makes a call.';

/** iPhone: put "Talk to SmartAssist" on the Action Button (iPhone 15 Pro and newer). */
export const IPHONE_ACTION_BUTTON_STEPS = [
  'This is for iPhones with an Action Button: the small button above the volume buttons. Leave SmartAssist, open the Settings app and tap Action Button.',
  'Swipe sideways until you see Shortcut. Then tap Choose a Shortcut.',
  'Find SmartAssist in the list and tap Talk to SmartAssist.',
  'You are ready. Press and hold the Action Button, and SmartAssist opens, ready to listen.',
];

/** Shown under the iPhone voice section. */
export const IPHONE_SIRI_TIP =
  'If Siri doesn’t answer, open the Settings app, search for Siri, and switch on “Hey Siri” or “Siri”.';

/** Shown in Expo Go or the web preview, where the screen reader is missing. */
export const UNAVAILABLE_MESSAGE =
  'Screen reading needs the full SmartAssist app on an Android phone. This test version cannot read other apps.';
