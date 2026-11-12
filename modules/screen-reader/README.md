# Screen reader (Android)

SmartAssist's own screen reader, written in Kotlin. Owner: Kosisochukwu.

Once the user switches on **Settings → Accessibility → SmartAssist → Use SmartAssist**, a yellow **Read screen** button floats over every app. Tapping it reads that app's screen aloud: first a one-line summary ("Settings. 11 buttons and 1 list."), then everything on it from top to bottom ("Button: Search Settings", "List, 28 items", …). While it reads, the button turns into **Pause / Continue**, **Next** and **Stop**.

- **Drag** the button to move it; it remembers where it was left and never goes off screen.
- It **hides itself inside SmartAssist**, which has its own big buttons and voice.
- It **stops reading when the user opens another screen**, rather than reading the old one (rule `stopWhenScreenChanges`).
- It speaks on the **accessibility volume**, like TalkBack, at the speed and pitch from SmartAssist's Settings.
- It never reads on its own: only when the user taps the button.

iPhone doesn't let apps read other apps' screens, so there is no iPhone version. On iPhone, the Read My Screen guide (`src/app/screen-reading.tsx`) helps the user turn on Apple's Speak Screen instead.

## Files

| File | What it does |
| --- | --- |
| `android/src/main/assets/reading-rules.json` | **The reading instructions.** Every word the reader says, what it skips, the summary, and whether to stop when the screen changes. Edit freely, keep the keys; `src/__tests__/readingRules.test.ts` checks it. |
| `…/SmartAssistReaderService.kt` | The accessibility service: shows the floating buttons, reads the screen when asked, hides in SmartAssist, stops when the screen changes |
| `…/ScreenText.kt` | Turns the other app's screen (Android's tree of "nodes") into lines to speak, following the rules |
| `…/ScreenSpeaker.kt` | Speaks the lines one at a time, with Pause, Continue, Next and Stop |
| `…/FloatingControls.kt` | The yellow, draggable buttons (High-contrast colours, 64 dp, 22 sp) |
| `…/ScreenReaderModule.kt` + `index.ts` | What the app's JavaScript can call: `isScreenReaderOn()`, `useScreenReaderOn()`, `openScreenReaderSettings()`, `setScreenReaderVoice()` |

## Building and testing

It is native code, so it needs a **development build**, not Expo Go:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
npx expo run:android          # builds, installs on the phone or emulator, starts the dev server
```

Changes to Kotlin or `reading-rules.json` need that build again; TypeScript changes reload by themselves.

- **See what it says without listening:** `adb logcat -s SmartAssistReader` prints every line it speaks, and every screen change it notices.
- **Emulator:** give it at least 4 CPU cores (`emulator -avd <name> -cores 4`). With 1 core, Android 17 froze and restarted itself while a build was installing.
- **If the yellow button doesn't appear** after installing a new build, switch Use SmartAssist off and on again.
