package expo.modules.screenreader

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
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
  }
}
