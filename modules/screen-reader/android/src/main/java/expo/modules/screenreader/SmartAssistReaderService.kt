package expo.modules.screenreader

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent

/**
 * SmartAssist's Android screen reader. Owner: Kosisochukwu.
 *
 * Runs after the user switches SmartAssist on in Settings > Accessibility.
 * It shows the floating Read screen button over every app and, when the
 * user taps it, reads the screen of the app they are in, following the
 * reading rules. It never reads on its own.
 */
class SmartAssistReaderService : AccessibilityService() {
  private var rules: ReadingRules? = null
  private var speaker: ScreenSpeaker? = null
  private var controls: FloatingControls? = null
  private var screenText: ScreenText? = null
  private var assistant: VoiceAssistant? = null
  private var testReceiver: BroadcastReceiver? = null

  /** The app screen in front right now, e.g. "com.android.settings/.Settings". */
  private var currentScreen: String? = null

  /** The screen being read aloud. */
  private var screenBeingRead: String? = null

  override fun onServiceConnected() {
    super.onServiceConnected()
    val loadedRules = ReadingRules.load(this)
    rules = loadedRules
    screenText = ScreenText(loadedRules)

    val newSpeaker = ScreenSpeaker(this) { state -> controls?.show(state) }
    speaker = newSpeaker
    Log.i(LOG_TAG, "Screen reader started")
    // Android can restart this service at any time (when SmartAssist gains a
    // permission, is updated, or a testing tool connects), sometimes halfway
    // through a command. So the assistant always talks through whichever
    // reader is running now, not necessarily this one.
    val newAssistant = VoiceAssistant(
      this,
      speak = { text, onDone -> (running ?: this).say(text, onDone) },
      readScreen = { (running ?: this).readScreen() },
    )
    assistant = newAssistant
    controls = FloatingControls(
      context = this,
      onRead = ::readScreen,
      onSpeak = newAssistant::listen,
      onPause = newSpeaker::pause,
      onContinue = newSpeaker::resume,
      onNext = newSpeaker::next,
      onStop = newSpeaker::stop,
    ).also { it.attach() }
    running = this
    listenForTestCommands()
    // Started while SmartAssist is open? Then hide straight away, without waiting for a new screen.
    Handler(Looper.getMainLooper()).postDelayed({ updatePanelVisibility(null) }, START_CHECK_MS)
  }

  /**
   * Hides the floating buttons while SmartAssist itself is in front or the
   * Listening card is open. "In front" is the app Android says is active;
   * keyboards and the notification shade send events too, but never become it.
   */
  private fun updatePanelVisibility(eventApp: String?) {
    val front = rootInActiveWindow?.packageName?.toString() ?: eventApp
    controls?.setHidden(front == packageName || VoiceActivity.isOpen)
  }

  /**
   * Development builds only: lets a developer type a voice command from the
   * Mac instead of speaking it:
   *   adb shell am broadcast -a com.classiscrimson.smartassist.TEST_COMMAND --es words "open settings"
   */
  private fun listenForTestCommands() {
    if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) return
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        intent.getStringExtra("words")?.let { carryOut(it) }
      }
    }
    val filter = IntentFilter("$packageName.TEST_COMMAND")
    if (Build.VERSION.SDK_INT >= 33) {
      registerReceiver(receiver, filter, RECEIVER_EXPORTED)
    } else {
      registerReceiver(receiver, filter)
    }
    testReceiver = receiver
  }

  /** Says one thing, such as the assistant's answer. Not screen reading, so a new screen doesn't stop it. */
  fun say(text: String, onDone: (() -> Unit)?) {
    screenBeingRead = null
    WakeWordService.yieldMicrophone() // so "Hey SmartAssist" doesn't hear SmartAssist talking
    speaker?.read(listOf(text), onDone)
  }

  /** True while SmartAssist is speaking (reading the screen or answering). */
  fun isTalking(): Boolean = speaker?.state == ReaderState.PLAYING

  /** Reads the app on screen: a one-sentence summary, then everything on it, top to bottom. */
  fun readScreen() {
    val text = screenText ?: return
    val rules = rules ?: return
    val root = rootInActiveWindow
    val lines = text.linesFor(root)
    screenBeingRead = currentScreen

    val spoken = mutableListOf<String>()
    if (lines.isEmpty()) {
      spoken.add(rules.phrase("nothingToRead"))
    } else {
      if (rules.summaryEnabled) {
        spoken.add(text.summaryFor(appName(root?.packageName), lines))
      }
      spoken.addAll(lines.map { it.text })
      spoken.add(rules.phrase("endOfScreen"))
    }
    WakeWordService.yieldMicrophone()
    speaker?.read(spoken)
  }

  /** "WhatsApp" for com.whatsapp: the name the user sees on the home screen. */
  private fun appName(packageName: CharSequence?): String {
    if (packageName == null) return ""
    return try {
      val info = packageManager.getApplicationInfo(packageName.toString(), 0)
      packageManager.getApplicationLabel(info).toString()
    } catch (e: Exception) {
      ""
    }
  }

  /**
   * Android tells the reader whenever a new screen, dialog or menu opens.
   * The reader uses that to hide its buttons inside SmartAssist and to stop
   * reading a screen the user has left. It never starts reading by itself.
   */
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    // Our own floating buttons appearing or changing is not a new screen.
    if (event.className == FloatingControls.PANEL_CLASS_NAME) return
    val app = event.packageName?.toString() ?: return
    val screen = "$app/${event.className}"
    Log.d(LOG_TAG, "Screen changed: $screen")

    // SmartAssist has its own big buttons and voice, so the floating ones would only get in the way.
    // Also hidden while the Listening card is open, even under Android's permission box.
    updatePanelVisibility(app)

    val reading = speaker?.state != ReaderState.IDLE
    if (reading && rules?.stopWhenScreenChanges == true && screenBeingRead != null && screen != screenBeingRead) {
      speaker?.stop()
    }
    currentScreen = screen
  }

  override fun onInterrupt() {
    speaker?.stop()
  }

  override fun onDestroy() {
    Log.i(LOG_TAG, "Screen reader stopped")
    if (running === this) running = null
    testReceiver?.let { unregisterReceiver(it) }
    controls?.detach()
    speaker?.shutdown()
    super.onDestroy()
  }

  /** Listens for a voice command, as if Speak were tapped. Used by the app's own mic button. */
  fun listen() = assistant?.listen()

  /** Carries out typed words as a voice command. For testing without a microphone. */
  fun carryOut(words: String) = assistant?.carryOut(words)

  companion object {
    private const val LOG_TAG = "SmartAssistReader"

    /** How long after starting to check which app is in front (Android needs a moment). */
    private const val START_CHECK_MS = 500L

    /** The screen reader while it is switched on, so the app can talk to it. */
    var running: SmartAssistReaderService? = null
      private set
  }
}
