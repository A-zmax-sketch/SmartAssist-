import AVFoundation
import Foundation
import Speech

/// Hears one voice command with Apple's speech recognition. Owner: Kosisochukwu.
///
/// It sends events to JavaScript:
///   ["type": "partial", "text": …]  the words so far, while the user talks
///   ["type": "end", "text": …]      finished; text is "" if nothing was heard
///   ["type": "error", "code": …]    "permission", "unavailable" or "audio"
///
/// It stops by itself when the user stops talking, so nobody has to press Stop.
/// It works on the phone (no internet) when the iPhone supports that.
final class SpeechListener {
  typealias Emit = ([String: Any]) -> Void

  /// Stop this long after the last word.
  private static let pauseAfterWords: TimeInterval = 1.8
  /// For "yes" or "no", stop sooner.
  private static let pauseAfterShortAnswer: TimeInterval = 1.0
  /// Give up if nothing is said for this long.
  private static let waitForWords: TimeInterval = 8
  /// Never listen longer than this.
  private static let longest: TimeInterval = 30
  /// After stopping, wait this long for Apple's final, tidied-up words.
  private static let waitForFinal: TimeInterval = 1.2

  private let options: ListenOptions
  private let emit: Emit
  private let engine = AVAudioEngine()
  private let requestLock = NSLock()
  private var currentRequest: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var recognizer: SFSpeechRecognizer?
  private var onDevice = false
  /// Counts recognitions, so late answers from a replaced one are ignored.
  private var generation = 0
  private var heard = ""
  private var finished = false
  private var audioRunning = false
  private var timer: DispatchWorkItem?

  init(options: ListenOptions, emit: @escaping Emit) {
    self.options = options
    self.emit = emit
  }

  // MARK: Permission

  static func requestPermission(_ done: @escaping (String) -> Void) {
    SFSpeechRecognizer.requestAuthorization { status in
      switch status {
      case .authorized:
        askForMicrophone { granted in
          DispatchQueue.main.async { done(granted ? "granted" : "denied") }
        }
      case .restricted:
        DispatchQueue.main.async { done("restricted") }
      default:
        DispatchQueue.main.async { done("denied") }
      }
    }
  }

  private static func askForMicrophone(_ done: @escaping (Bool) -> Void) {
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission(completionHandler: done)
    } else {
      AVAudioSession.sharedInstance().requestRecordPermission(done)
    }
  }

  // MARK: Listening (all on the main thread)

  /// Starts listening. Returns false, after sending an error event, if it can't.
  func start() -> Bool {
    guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
      return fail("permission")
    }
    guard let recognizer = Self.englishRecognizer(), recognizer.isAvailable else {
      return fail("unavailable")
    }
    self.recognizer = recognizer

    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .duckOthers])
      try session.setActive(true, options: .notifyOthersOnDeactivation)
    } catch {
      return fail("audio")
    }

    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else {
      SpeakingAudio.use()
      return fail("audio")
    }
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request?.append(buffer)
    }
    engine.prepare()
    do {
      try engine.start()
    } catch {
      input.removeTap(onBus: 0)
      SpeakingAudio.use()
      return fail("audio")
    }
    audioRunning = true

    // On the phone first: faster, private and works without internet.
    beginRecognition(onDevice: recognizer.supportsOnDeviceRecognition)
    restartTimer(after: Self.waitForWords)
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.longest) { [weak self] in self?.finish() }
    return true
  }

  /// Stops listening and keeps what was heard.
  func finish() {
    guard !finished, audioRunning else { return }
    stopAudio()
    request?.endAudio()
    // Apple usually sends final words straight away; don't wait for ever.
    restartTimer(after: Self.waitForFinal, then: { [weak self] in self?.end() })
  }

  /// Stops listening and throws away what was heard. Sends no event.
  func cancel() {
    guard !finished else { return }
    finished = true
    timer?.cancel()
    stopAudio()
    task?.cancel()
  }

  // MARK: Inside

  private var request: SFSpeechAudioBufferRecognitionRequest? {
    get { requestLock.lock(); defer { requestLock.unlock() }; return currentRequest }
    set { requestLock.lock(); currentRequest = newValue; requestLock.unlock() }
  }

  private func beginRecognition(onDevice: Bool) {
    guard let recognizer else { return }
    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.taskHint = options.shortAnswer ? .confirmation : .dictation
    request.contextualStrings = options.contextualStrings
    request.requiresOnDeviceRecognition = onDevice
    request.addsPunctuation = false
    self.onDevice = onDevice
    self.request = request
    generation += 1
    let thisGeneration = generation
    task = recognizer.recognitionTask(with: request) { [weak self] result, error in
      DispatchQueue.main.async {
        guard let self, self.generation == thisGeneration else { return }
        self.handle(result: result, error: error)
      }
    }
  }

  private func handle(result: SFSpeechRecognitionResult?, error: Error?) {
    guard !finished else { return }
    if let result {
      let text = result.bestTranscription.formattedString
      if !text.isEmpty, text != heard {
        heard = text
        emit(["type": "partial", "text": text])
        if audioRunning {
          restartTimer(after: options.shortAnswer ? Self.pauseAfterShortAnswer : Self.pauseAfterWords)
        }
      }
      if result.isFinal {
        end()
        return
      }
    }
    if error != nil {
      // The on-phone recogniser can fail (e.g. its language isn't downloaded).
      // If nothing was heard yet, carry on with Apple's online one instead.
      if onDevice, heard.isEmpty, audioRunning {
        task?.cancel()
        beginRecognition(onDevice: false)
        return
      }
      end()
    }
  }

  private func end() {
    guard !finished else { return }
    finished = true
    timer?.cancel()
    stopAudio()
    task?.cancel()
    emit(["type": "end", "text": heard])
  }

  private func fail(_ code: String) -> Bool {
    finished = true
    emit(["type": "error", "code": code])
    return false
  }

  private func stopAudio() {
    guard audioRunning else { return }
    audioRunning = false
    engine.stop()
    engine.inputNode.removeTap(onBus: 0)
    SpeakingAudio.use()
  }

  /// After `delay` with no new words: stop listening (or run `then`).
  private func restartTimer(after delay: TimeInterval, then action: (() -> Void)? = nil) {
    timer?.cancel()
    let work = DispatchWorkItem { [weak self] in
      if let action { action() } else { self?.finish() }
    }
    timer = work
    DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
  }

  /// SmartAssist's commands are in English. Use the phone's English (e.g.
  /// en-GB, en-NG) if Apple supports it, else British, then American English.
  private static func englishRecognizer() -> SFSpeechRecognizer? {
    var locales: [Locale] = []
    if Locale.current.language.languageCode?.identifier == "en" {
      locales.append(Locale.current)
    }
    locales += [Locale(identifier: "en-GB"), Locale(identifier: "en-US")]
    for locale in locales {
      if let recognizer = SFSpeechRecognizer(locale: locale) {
        return recognizer
      }
    }
    return nil
  }
}

/// How SmartAssist's own voice sounds on iPhone.
enum SpeakingAudio {
  /// Plays through the loudspeaker and can still be heard when the phone is
  /// on silent, like VoiceOver. Music keeps playing underneath.
  static func use() {
    let session = AVAudioSession.sharedInstance()
    try? session.setActive(false, options: .notifyOthersOnDeactivation)
    try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
  }
}
