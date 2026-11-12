package expo.modules.screenreader

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** What came back from listening. */
sealed class VoiceResult {
  data class Heard(val text: String) : VoiceResult()
  data object NothingHeard : VoiceResult()
  data object Cancelled : VoiceResult()
  data object NoPermission : VoiceResult()
}

/**
 * The "Listening…" card SmartAssist shows over any app while it listens.
 * Owner: Kosisochukwu.
 *
 * Android only lets an app use the microphone while it is on screen, so the
 * screen reader opens this small window for the few seconds it listens. It
 * also asks for any permission the assistant needs (microphone, contacts,
 * SMS, phone), since only a window on screen can ask.
 *
 * High-contrast look: black card, yellow border, 26 sp words, a 64 dp Cancel button.
 */
class VoiceActivity : Activity() {
  private var recognizer: SpeechRecognizer? = null
  private lateinit var heardText: TextView
  private var finished = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    isOpen = true
    setContentView(buildCard(intent.getStringExtra(EXTRA_PROMPT) ?: ""))

    val permissions = intent.getStringArrayExtra(EXTRA_PERMISSIONS)
    if (permissions != null) {
      // Only asking for permissions, not listening.
      requestPermissions(permissions, REQUEST_PERMISSIONS)
    } else if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MICROPHONE)
    } else {
      startListening()
    }
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    val allGranted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
    when (requestCode) {
      REQUEST_MICROPHONE -> if (allGranted) startListening() else deliver(VoiceResult.NoPermission)
      REQUEST_PERMISSIONS -> deliver(if (allGranted) VoiceResult.Heard("granted") else VoiceResult.NoPermission)
    }
  }

  private fun startListening() {
    if (!SpeechRecognizer.isRecognitionAvailable(this)) {
      deliver(VoiceResult.NothingHeard)
      return
    }
    val listener = object : RecognitionListener {
      override fun onPartialResults(partialResults: Bundle?) {
        partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let {
          heardText.text = it
        }
      }

      override fun onResults(results: Bundle?) {
        val best = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
        deliver(if (best.isNullOrBlank()) VoiceResult.NothingHeard else VoiceResult.Heard(best))
      }

      override fun onError(error: Int) {
        deliver(if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) VoiceResult.NoPermission else VoiceResult.NothingHeard)
      }

      override fun onReadyForSpeech(params: Bundle?) {}
      override fun onBeginningOfSpeech() {}
      override fun onRmsChanged(rmsdB: Float) {}
      override fun onBufferReceived(buffer: ByteArray?) {}
      override fun onEndOfSpeech() {}
      override fun onEvent(eventType: Int, params: Bundle?) {}
    }
    recognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
      setRecognitionListener(listener)
      startListening(
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
          .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1),
      )
    }
  }

  /** Hands the result to the screen reader and closes the card. Only once. */
  private fun deliver(result: VoiceResult) {
    if (finished) return
    finished = true
    isOpen = false
    Log.i(LOG_TAG, "Listening card result: $result")
    recognizer?.destroy()
    recognizer = null
    finish()
    val callback = pending
    pending = null
    callback?.invoke(result)
  }

  override fun onDestroy() {
    deliver(VoiceResult.Cancelled) // closed some other way, e.g. the Back button
    super.onDestroy()
  }

  private fun buildCard(prompt: String): LinearLayout {
    val yellow = Color.parseColor(FloatingControls.YELLOW)
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(24), dp(24), dp(24), dp(24))
      background = GradientDrawable().apply {
        setColor(Color.BLACK)
        cornerRadius = dp(24).toFloat()
        setStroke(dp(3), yellow)
      }
    }
    card.addView(text(prompt.ifEmpty { "Listening…" }, 30f, yellow, bold = true))
    heardText = text("", 26f, Color.WHITE, bold = false)
    card.addView(heardText)
    card.addView(
      Button(this).apply {
        text = "Cancel"
        contentDescription = "Cancel"
        isAllCaps = false
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(Color.BLACK)
        minHeight = dp(64)
        minimumHeight = dp(64)
        background = GradientDrawable().apply {
          setColor(yellow)
          cornerRadius = dp(16).toFloat()
        }
        setOnClickListener { deliver(VoiceResult.Cancelled) }
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
          .apply { topMargin = dp(16) }
      },
    )
    // The card sits at the bottom of the screen, over a dimmed version of the app.
    return LinearLayout(this).apply {
      gravity = Gravity.BOTTOM
      setBackgroundColor(Color.parseColor("#99000000"))
      setPadding(dp(16), dp(16), dp(16), dp(32))
      addView(card, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }
  }

  private fun text(words: String, sizeSp: Float, color: Int, bold: Boolean) = TextView(this).apply {
    text = words
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
    setTextColor(color)
    if (bold) setTypeface(typeface, Typeface.BOLD)
    setPadding(0, dp(4), 0, dp(4))
  }

  private fun dp(value: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

  companion object {
    private const val LOG_TAG = "SmartAssistReader"
    private const val EXTRA_PROMPT = "prompt"

    /** True while the card is on screen, so the floating buttons stay out of its way. */
    var isOpen = false
      private set
    private const val EXTRA_PERMISSIONS = "permissions"
    private const val REQUEST_MICROPHONE = 1
    private const val REQUEST_PERMISSIONS = 2

    /** Where the result goes. Only one listening card is open at a time. */
    private var pending: ((VoiceResult) -> Unit)? = null

    /** Shows the card and listens. `prompt` is the big line, e.g. "Say yes or no." */
    fun listen(context: Context, prompt: String, onResult: (VoiceResult) -> Unit) =
      open(context, Intent(context, VoiceActivity::class.java).putExtra(EXTRA_PROMPT, prompt), onResult)

    /** Shows the card only to ask for permissions. Heard("granted") means all were allowed. */
    fun askPermissions(context: Context, prompt: String, permissions: Array<String>, onResult: (VoiceResult) -> Unit) =
      open(
        context,
        Intent(context, VoiceActivity::class.java).putExtra(EXTRA_PROMPT, prompt).putExtra(EXTRA_PERMISSIONS, permissions),
        onResult,
      )

    private fun open(context: Context, intent: Intent, onResult: (VoiceResult) -> Unit) {
      pending?.invoke(VoiceResult.Cancelled) // a card that was still open
      pending = onResult
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION))
    }
  }
}
