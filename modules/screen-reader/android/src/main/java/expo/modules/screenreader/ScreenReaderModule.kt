package expo.modules.screenreader

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * What SmartAssist's JavaScript can ask the Android screen reader.
 * Used through modules/screen-reader/index.ts.
 */
class ScreenReaderModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ScreenReader")

    /** True if the user has switched SmartAssist on in Settings > Accessibility. */
    Function("isEnabled") {
      val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
      manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK).any { info ->
        val service = info.resolveInfo.serviceInfo
        service.packageName == context.packageName && service.name == SmartAssistReaderService::class.java.name
      }
    }

    /** Opens the phone's Accessibility settings, where the user switches SmartAssist on or off. */
    Function("openSettings") {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    /** Saves the voice speed and pitch from Settings, so the screen reader sounds the same as the app. */
    Function("setVoice") { rate: Double, pitch: Double ->
      VoicePrefs.save(context, rate.toFloat(), pitch.toFloat())
    }

    /** Opens the Listening card for a voice command. False if screen reading is switched off. */
    Function("listen") {
      val service = SmartAssistReaderService.running ?: return@Function false
      service.listen()
      true
    }

    /**
     * Starts "Hey SmartAssist" listening. Only works while SmartAssist is on
     * screen and has the microphone permission. False if Android refused.
     */
    Function("startWakeWord") { WakeWordService.start(context) }

    Function("stopWakeWord") { WakeWordService.stop(context) }

    /** True while "Hey SmartAssist" is listening. */
    Function("isWakeWordOn") { WakeWordService.isRunning }

    /** True if the user turned "Hey SmartAssist" on, even if the phone restarted since. */
    Function("isWakeWordWanted") { WakeWordService.isWanted(context) }

    /**
     * Opens the Listening card and gives back what was heard, without acting
     * on it: SmartAssist's own commands ("bigger text", "start laundry") are
     * carried out by the app. Works with screen reading off, too.
     * Resolves to { kind: "heard", text } or { kind: "nothing" | "cancelled" | "denied" }.
     */
    AsyncFunction("hearOnce") { prompt: String, promise: Promise ->
      VoiceActivity.listen(context, prompt) { result ->
        promise.resolve(
          when (result) {
            is VoiceResult.Heard -> mapOf("kind" to "heard", "text" to result.text)
            VoiceResult.NothingHeard -> mapOf("kind" to "nothing")
            VoiceResult.Cancelled -> mapOf("kind" to "cancelled")
            VoiceResult.NoPermission -> mapOf("kind" to "denied")
          },
        )
      }
    }

    /** Carries out words as a voice command (phone commands: apps, messages, calls). False if screen reading is off. */
    Function("carryOut") { words: String ->
      val service = SmartAssistReaderService.running ?: return@Function false
      service.carryOut(words)
      true
    }
  }
}
