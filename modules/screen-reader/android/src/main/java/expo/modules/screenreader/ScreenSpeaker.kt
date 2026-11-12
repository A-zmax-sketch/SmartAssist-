package expo.modules.screenreader

import android.content.Context
import android.media.AudioAttributes
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log

private const val LOG_TAG = "SmartAssistReader"

/** idle: not reading. playing: reading aloud. paused: stopped part-way, Continue carries on. */
enum class ReaderState { IDLE, PLAYING, PAUSED }

/**
 * Speed and pitch chosen in SmartAssist's Settings. The app saves them here
 * (through ScreenReaderModule.setVoice) so the screen reader uses them too.
 */
object VoicePrefs {
  private const val FILE = "smartassist_screen_reader"

  fun save(context: Context, rate: Float, pitch: Float) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
      .putFloat("rate", rate)
      .putFloat("pitch", pitch)
      .apply()
  }

  fun rate(context: Context): Float = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getFloat("rate", 1f)

  fun pitch(context: Context): Float = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getFloat("pitch", 1f)
}

/**
 * Speaks a list of lines one after another with the phone's voice.
 *
 * Works like src/services/speech.ts: every read, pause or skip starts a new
 * "run", and a line that finishes late only moves on if its run is still the
 * current one. That stops Pause or Stop being undone a moment later.
 */
class ScreenSpeaker(
  private val context: Context,
  private val onStateChange: (ReaderState) -> Unit,
) {
  private val main = Handler(Looper.getMainLooper())
  private var tts: TextToSpeech? = null
  private var ready = false
  private var lines: List<String> = emptyList()
  private var index = 0
  private var run = 0

  var state = ReaderState.IDLE
    private set(value) {
      field = value
      onStateChange(value)
    }

  init {
    tts = TextToSpeech(context) { status ->
      main.post {
        ready = status == TextToSpeech.SUCCESS
        if (ready && state == ReaderState.PLAYING) {
          speakCurrent() // a read was asked for before the voice was ready
        }
      }
    }
    // Speak on the accessibility volume, like TalkBack, rather than the music volume.
    tts?.setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build(),
    )
    tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
      override fun onStart(utteranceId: String?) {}

      override fun onDone(utteranceId: String?) {
        main.post { lineFinished(utteranceId) }
      }

      @Deprecated("Required by older Android versions")
      override fun onError(utteranceId: String?) {
        main.post { lineFinished(utteranceId) } // skip a line the voice can't say
      }
    })
  }

  /** Runs once the last line has been spoken (not if Pause, Next or Stop interrupt it). */
  private var onDone: (() -> Unit)? = null

  /**
   * Reads `newLines` from the first one. `onDone` runs when it has finished
   * speaking, for example to start listening for "yes" only after a question.
   */
  fun read(newLines: List<String>, onDone: (() -> Unit)? = null) {
    lines = newLines
    index = 0
    this.onDone = onDone
    startRun()
  }

  /** Stops but remembers the line, so Continue carries on from it. */
  fun pause() {
    if (state != ReaderState.PLAYING) return
    run += 1
    tts?.stop()
    state = ReaderState.PAUSED
  }

  /** Carries on from the line where Pause stopped. */
  fun resume() {
    if (state == ReaderState.PAUSED) startRun()
  }

  /** Skips to the next line. */
  fun next() {
    if (state == ReaderState.IDLE) return
    index += 1
    startRun()
  }

  /** Stops reading and forgets the place. */
  fun stop() {
    run += 1
    tts?.stop()
    index = 0
    onDone = null
    state = ReaderState.IDLE
  }

  fun shutdown() {
    stop()
    tts?.shutdown()
    tts = null
  }

  private fun startRun() {
    run += 1
    state = ReaderState.PLAYING
    if (ready) speakCurrent()
  }

  private fun speakCurrent() {
    if (index >= lines.size) {
      state = ReaderState.IDLE
      index = 0
      val finished = onDone
      onDone = null
      finished?.invoke()
      return
    }
    val voice = tts ?: return
    voice.setSpeechRate(VoicePrefs.rate(context))
    voice.setPitch(VoicePrefs.pitch(context))
    // Shows each line in the log, so you can check the reading rules without
    // listening: adb logcat -s SmartAssistReader
    Log.i(LOG_TAG, "${index + 1}/${lines.size}: ${lines[index]}")
    voice.speak(lines[index], TextToSpeech.QUEUE_FLUSH, null, "$run:$index")
  }

  private fun lineFinished(utteranceId: String?) {
    if (utteranceId != "$run:$index" || state != ReaderState.PLAYING) {
      return // from an older run: Pause, Next or Stop happened since
    }
    index += 1
    speakCurrent()
  }
}
