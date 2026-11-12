package expo.modules.screenreader

import android.accessibilityservice.AccessibilityService
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
    controls = FloatingControls(
      context = this,
      onRead = ::readScreen,
      onPause = newSpeaker::pause,
      onContinue = newSpeaker::resume,
      onNext = newSpeaker::next,
      onStop = newSpeaker::stop,
    ).also { it.attach() }
  }

  /** Reads the app on screen: a one-sentence summary, then everything on it, top to bottom. */
  private fun readScreen() {
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
    controls?.setHidden(app == packageName)

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
    controls?.detach()
    speaker?.shutdown()
    super.onDestroy()
  }

  private companion object {
    const val LOG_TAG = "SmartAssistReader"
  }
}
