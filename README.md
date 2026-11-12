# SmartAssist

A voice-first phone app for blind and low-vision people, older adults, and anyone who finds phones hard to use. It reads text aloud, understands spoken commands, shows everything in large, high-contrast text, and (in the camera prototype) finds and reads printed signs.

Built with React Native and Expo (SDK 58) for Android and iPhone from one codebase, by group **Classis Crimson** for Software Engineering Assignment 3.

## Team

| Member | Role |
| --- | --- |
| Kachi (Onuorah Kasaluchi C.) | Project manager, integration, design |
| Kosisochukwu (Uchennendu Kosisochukwu Kalu) | Text-to-speech, UI |
| The Revenant | Voice commands, UI |
| Backend/testing member 1 | Settings and data storage |
| Backend/testing member 2 | Voice command logic and its tests |
| Backend/testing member 3 | Testing and QA |

## Progress

| Phase | What it delivers | Status |
| --- | --- | --- |
| 0. Design | Mock-ups of the core screens | In progress |
| 1. Skeleton | Project, navigation, theme, all 14 screens as placeholders | Done |
| 2. Large-text UI | Real layouts, settings saved on the phone | Next |
| 3. Text-to-speech | Read Aloud working | |
| 4. Voice commands | Development build, speech recognition, 14 commands | |
| 5. Extra screens | Help, Saved Texts, Routines, Practice and more | |
| 6. Camera prototype | Find a printed sign, Read the exact line, Magnifier | |
| 7. Testing and demo | Test plan, device testing, demo video | |

The full plan (screens, design system, voice commands, who owns what) is in the **SmartAssist MVP Plan** doc. Ask Kachi for the link.

## Run the app

You need [Node.js](https://nodejs.org) (the LTS version) and Git on your laptop, and the **Expo Go** app on your phone (Play Store or App Store, latest version).

```bash
git clone https://github.com/A-zmax-sketch/SmartAssist-.git
cd SmartAssist-
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iPhone). Your phone and laptop must be on the same Wi-Fi.

No phone handy? Run `npm run web` to open the app in your browser.

Voice commands and the camera features (phases 4 and 6) will need a **development build** instead of Expo Go. A guide will be added in phase 4.

## Checks

```bash
npm test            # automated tests
npm run typecheck   # TypeScript errors
npm run lint        # code style problems
```

These also run automatically on every pull request.

## Where things live

```text
src/app/          one file per screen (Expo Router: the file name is the route)
src/components/   shared building blocks: Screen, BigButton, Tile, MicButton, AppText
src/theme/        colours, text sizes and spacing from the design system
src/storage/      saving settings and data on the phone
src/__tests__/    automated tests
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before your first change. It explains, step by step, how to make a branch, commit and open a pull request, all from your browser.
