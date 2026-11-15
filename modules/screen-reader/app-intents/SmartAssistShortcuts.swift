import AppIntents
import Foundation

// SmartAssist's Siri phrases and Action Button shortcuts on iPhone.
// Owner: Kosisochukwu.
//
// iPhone apps can't listen for their own wake word, so "Hey SmartAssist"
// becomes "Hey Siri, talk to SmartAssist". The same shortcuts can be put on
// the iPhone's Action Button or Back Tap, and show up in the Shortcuts app.
//
// This file belongs to the app itself, not the module (Apple only finds
// shortcuts in the app). modules/screen-reader/app.plugin.js copies it into
// ios/ on every prebuild. Each shortcut opens SmartAssist and leaves a
// message for it; LaunchActions in ScreenReaderModule.swift reads it. Keep
// the key and notification names the same in both files.

private func askSmartAssist(to action: String) {
  let defaults = UserDefaults.standard
  defaults.set(action, forKey: "smartassist.launchAction")
  defaults.set(Date().timeIntervalSince1970, forKey: "smartassist.launchActionAt")
  NotificationCenter.default.post(name: Notification.Name("SmartAssistLaunchAction"), object: nil)
}

/// "Hey Siri, talk to SmartAssist": opens SmartAssist, ready for a command.
struct TalkToSmartAssistIntent: AppIntent {
  static let title: LocalizedStringResource = "Talk to SmartAssist"
  static let description = IntentDescription("Opens SmartAssist and listens for a command, like “Send a message to Mum”.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    askSmartAssist(to: "listen")
    return .result()
  }
}

/// "Hey Siri, read aloud with SmartAssist": opens Read Aloud.
struct ReadAloudIntent: AppIntent {
  static let title: LocalizedStringResource = "Read Aloud"
  static let description = IntentDescription("Opens SmartAssist's Read Aloud, to hear text you type or paste.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    askSmartAssist(to: "readAloud")
    return .result()
  }
}

/// "Hey Siri, read my copied text with SmartAssist": reads what was copied in any app.
struct ReadCopiedTextIntent: AppIntent {
  static let title: LocalizedStringResource = "Read Copied Text"
  static let description = IntentDescription("Opens SmartAssist and reads aloud the text you copied.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    askSmartAssist(to: "readCopied")
    return .result()
  }
}

/// The phrases Siri knows without any setup. Each must contain the app's name.
/// (Short titles and icons need iOS 17; the app itself still runs on iOS 16.4.)
@available(iOS 17.0, *)
struct SmartAssistShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: TalkToSmartAssistIntent(),
      phrases: [
        "Talk to \(.applicationName)",
        "Ask \(.applicationName)",
        "Open \(.applicationName) and listen",
        "\(.applicationName) listen",
      ],
      shortTitle: "Talk to SmartAssist",
      systemImageName: "mic.fill"
    )
    AppShortcut(
      intent: ReadCopiedTextIntent(),
      phrases: [
        "Read my copied text with \(.applicationName)",
        "Read copied text with \(.applicationName)",
        "\(.applicationName) read what I copied",
      ],
      shortTitle: "Read Copied Text",
      systemImageName: "doc.on.clipboard"
    )
    AppShortcut(
      intent: ReadAloudIntent(),
      phrases: [
        "Read aloud with \(.applicationName)",
        "Open \(.applicationName) Read Aloud",
      ],
      shortTitle: "Read Aloud",
      systemImageName: "speaker.wave.2.fill"
    )
  }
}
