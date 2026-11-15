import ExpoModulesCore
import UIKit

/// SmartAssist on iPhone, as seen from JavaScript. Owner: Kosisochukwu.
///
/// Apple doesn't let an app read other apps' screens or float buttons over
/// them, so the iPhone side is different from Android:
/// - reading the screen is done by Apple's own Speak Screen; this module
///   tells the app whether the user has switched it on,
/// - voice commands are heard inside SmartAssist (SpeechListener),
/// - "Hey Siri, talk to SmartAssist" and the Action Button reach the app
///   through LaunchActions (see app-intents/SmartAssistShortcuts.swift),
/// - SmartAssist's voice is made loud enough to hear on silent (SpeakingAudio).
public class ScreenReaderModule: Module {
  private var listener: SpeechListener?
  private var launchObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("ScreenReader")

    Events("onSpeech", "onLaunchAction")

    OnCreate {
      SpeakingAudio.use()
      self.launchObserver = NotificationCenter.default.addObserver(
        forName: LaunchActions.notification, object: nil, queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onLaunchAction", [:])
      }
    }

    OnDestroy {
      if let observer = self.launchObserver {
        NotificationCenter.default.removeObserver(observer)
      }
      self.listener?.cancel()
    }

    /// Whether Settings > Accessibility > Spoken Content > Speak Screen is on.
    AsyncFunction("isSpeakScreenOn") { () -> Bool in
      UIAccessibility.isSpeakScreenEnabled
    }.runOnQueue(.main)

    /// Asks for speech recognition and the microphone. "granted", "denied" or "restricted".
    AsyncFunction("requestSpeechPermission") { (promise: Promise) in
      SpeechListener.requestPermission { promise.resolve($0) }
    }

    /// Starts listening. What is heard arrives as "onSpeech" events. False if it couldn't start.
    AsyncFunction("startListening") { (options: ListenOptions) -> Bool in
      self.listener?.cancel()
      let listener = SpeechListener(options: options) { [weak self] event in
        self?.sendEvent("onSpeech", event)
      }
      self.listener = listener
      return listener.start()
    }.runOnQueue(.main)

    /// Stops listening and keeps what was heard (like the user stopping talking).
    AsyncFunction("stopListening") {
      self.listener?.finish()
    }.runOnQueue(.main)

    /// Stops listening and throws away what was heard.
    AsyncFunction("cancelListening") {
      self.listener?.cancel()
      self.listener = nil
    }.runOnQueue(.main)

    /// What Siri, the Action Button or Shortcuts asked for ("listen", "readAloud"), once.
    Function("takeLaunchAction") { () -> String? in
      LaunchActions.take()
    }
  }
}

/// Options JavaScript passes to startListening.
struct ListenOptions: Record {
  /// Words the user is likely to say (app and contact names), so they are heard right.
  @Field var contextualStrings: [String] = []
  /// True when waiting for a short answer like "yes" or "no".
  @Field var shortAnswer: Bool = false
}

/// Siri, the Action Button and Shortcuts open SmartAssist through App Intents
/// (app-intents/SmartAssistShortcuts.swift, added to the app by app.plugin.js).
/// The intent leaves the action here and posts a notification; JavaScript
/// picks it up with takeLaunchAction(). The key names must match that file.
enum LaunchActions {
  static let notification = Notification.Name("SmartAssistLaunchAction")
  private static let actionKey = "smartassist.launchAction"
  private static let timeKey = "smartassist.launchActionAt"
  /// An action older than this is stale (the app was opened some other way later).
  private static let maxAge: TimeInterval = 120

  static func take() -> String? {
    let defaults = UserDefaults.standard
    let action = defaults.string(forKey: actionKey)
    let time = defaults.double(forKey: timeKey)
    defaults.removeObject(forKey: actionKey)
    defaults.removeObject(forKey: timeKey)
    guard let action, Date().timeIntervalSince1970 - time < maxAge else { return nil }
    return action
  }
}
