# Screen reader (Android)

SmartAssist's own screen reader, written in Kotlin. Owner: Kosisochukwu.

Once the user switches on **Settings → Accessibility → SmartAssist → Use SmartAssist**, a yellow **Read screen** button floats over every app. Tapping it reads that app's screen aloud: first a one-line summary ("Settings. 11 buttons and 1 list."), then everything on it from top to bottom ("Button: Search Settings", "List, 28 items", …). While it reads, the button turns into **Pause / Continue**, **Next** and **Stop**.

- **Drag** the button to move it; it remembers where it was left and never goes off screen.
- It **hides itself inside SmartAssist**, which has its own big buttons and voice.
- It **stops reading when the user opens another screen**, rather than reading the old one (rule `stopWhenScreenChanges`).
- It speaks on the **accessibility volume**, like TalkBack, at the speed and pitch from SmartAssist's Settings.
- It never reads on its own: only when the user taps the button.

## Voice commands

The panel also has a **Speak** button. Tap it and a big "Listening…" card appears over whatever app is open; say a command:

| Say | SmartAssist |
| --- | --- |
| "Open WhatsApp", "launch the camera" | Opens any installed app by its name |
| "Send a message to Mum saying I'm on my way" | Finds Mum in Contacts, asks *"Send: I'm on my way. To Mum, on WhatsApp? Say yes or no."*, and only on **yes** opens the chat and presses Send |
| "Text David saying I'm home" | The same, by SMS |
| "Call Mum" | Asks first, then calls |
| "What time is it", "What day is it", "How much battery" | Answers out loud |
| "Read the screen", "Help" | Reads the screen; lists what you can say |

Anything that sends or calls is **always read back first**, and anything but a clear "yes" (including silence) cancels it. Permissions (microphone, contacts, SMS, phone) are asked for the first time each is needed, on the Listening card.

### "Hey SmartAssist"

In SmartAssist: Read Aloud → **How to use it** → **Turn on "Hey SmartAssist"**. SmartAssist then listens all the time: say "Hey SmartAssist, open WhatsApp", or just "Hey SmartAssist" and the Listening card opens for the command.

- Android only lets an app keep the microphone on as a **foreground service with a notification**, started while the app is on screen. So it is turned on inside SmartAssist, and a "Listening for Hey SmartAssist" notification with a **Turn off** button shows while it listens. After the phone restarts, it comes back the next time SmartAssist is opened.
- It pauses while SmartAssist is talking or the Listening card is open, so it never hears itself.
- It uses the phone's **offline** speech recognition when the English speech pack is downloaded (Settings → System → Languages → Speech, or the Google app's offline speech settings), and the normal Google recogniser otherwise. It doesn't ask to download the pack itself, because that pops up a box every time.
- It uses more battery than tap-to-talk.

All the wording lives in `android/src/main/assets/voice-commands.json`: the patterns people say, with `{placeholders}`, and every reply. `src/services/voiceCommands.ts` follows the same matching rules as `VoiceCommands.kt`, and `src/__tests__/voiceCommands.test.ts` checks every example in the file.

iPhone doesn't let apps read other apps' screens, so there is no iPhone version. On iPhone, the Read My Screen guide (`src/app/screen-reading.tsx`) helps the user turn on Apple's Speak Screen instead.

## Files

| File | What it does |
| --- | --- |
| `android/src/main/assets/reading-rules.json` | **The reading instructions.** Every word the reader says, what it skips, the summary, and whether to stop when the screen changes. Edit freely, keep the keys; `src/__tests__/readingRules.test.ts` checks it. |
| `…/SmartAssistReaderService.kt` | The accessibility service: shows the floating buttons, reads the screen when asked, hides in SmartAssist, stops when the screen changes |
| `…/ScreenText.kt` | Turns the other app's screen (Android's tree of "nodes") into lines to speak, following the rules |
| `…/ScreenSpeaker.kt` | Speaks the lines one at a time, with Pause, Continue, Next and Stop |
| `…/FloatingControls.kt` | The yellow, draggable buttons (High-contrast colours, 64 dp, 22 sp) |
| `android/src/main/assets/voice-commands.json` | **The voice commands**: what people say and what SmartAssist answers |
| `…/VoiceAssistant.kt` | Carries out a command; asks "yes or no?" before sending or calling; presses WhatsApp's Send |
| `…/VoiceActivity.kt` | The "Listening…" card (Android only allows the microphone while an app is on screen) |
| `…/VoiceCommands.kt` | Matches heard words to a command (same rules as `src/services/voiceCommands.ts`) |
| `…/PhoneActions.kt` | Opens apps, finds contacts, WhatsApp, SMS, calls, time, date, battery |
| `…/WakeWordService.kt` | "Hey SmartAssist": listens all the time, with a notification |
| `…/ScreenReaderModule.kt` + `index.ts` | What the app's JavaScript can call: `isScreenReaderOn()`, `useScreenReaderOn()`, `openScreenReaderSettings()`, `setScreenReaderVoice()`, `listenForCommand()` |

## Building and testing

It is native code, so it needs a **development build**, not Expo Go:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
npx expo run:android          # builds, installs on the phone or emulator, starts the dev server
```

Changes to Kotlin or `reading-rules.json` need that build again; TypeScript changes reload by themselves.

- **See what it says without listening:** `adb logcat -s SmartAssistReader` prints every line it speaks, every word it hears, every button tapped and every screen change it notices.
- **Try a voice command without speaking** (development builds only):
  `adb shell am broadcast -a com.classiscrimson.smartassist.TEST_COMMAND --es words "'what time is it'"`
- **Speak to the emulator:** in its window, ⋯ → Microphone → turn on "Virtual microphone uses host audio input".
- Android **restarts the screen reader when SmartAssist gains a permission** (e.g. Contacts), sometimes mid-command. The assistant always talks through the reader that is running now, so the command carries on.
- **Emulator:** give it at least 4 CPU cores (`emulator -avd <name> -cores 4`). With 1 core, Android 17 froze and restarted itself while a build was installing. On the Mac it was tested on, the Android 17 emulator later crashed in its graphics emulation and then hung on start-up, so **test on a real Android phone** where you can.
- **Testing tools restart the screen reader:** `uiautomator` (and anything else that drives the screen) makes Android restart every accessibility service each time it connects. The reader copes (it checks which app is in front when it starts), but expect "Screen reader started / stopped" in the log while such tools run.
- **If the yellow button doesn't appear** after installing a new build, switch Use SmartAssist off and on again.
