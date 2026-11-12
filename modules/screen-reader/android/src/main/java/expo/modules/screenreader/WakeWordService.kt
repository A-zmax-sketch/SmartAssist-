package expo.modules.screenreader

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log

/**
 * "Hey SmartAssist": listens all the time for the wake words, then for a
 * command. Owner: Kosisochukwu.
 *
 * Android only lets an app keep the microphone on in the background as a
 * "foreground service" with a notification, started while the app is on
 * screen. So the user turns this on inside SmartAssist, and a notification
 * with a Turn off button shows while it listens.
 *
 * It uses the phone's own speech recognition (on the phone itself where
 * possible), one short listen after another. It pauses while SmartAssist is
 * talking or the Listening card is open, so it never hears itself.
 */
class WakeWordService : Service() {
  private val main = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null
  private var wakeWords: List<String> = emptyList()
  private var stopped = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      setWanted(this, false)
      stopSelf()
      return START_NOT_STICKY
    }
    try {
      showNotification()
    } catch (e: Exception) {
      // Android refused (e.g. no microphone permission, or not started from the app).
      Log.w(LOG_TAG, "Hey SmartAssist could not start: $e")
      stopSelf()
      return START_NOT_STICKY
    }
    if (recognizer == null) {
      wakeWords = VoiceCommands.load(this).wakeWords
      recognizer = createRecognizer()
      isRunning = true
      instance = this
      Log.i(LOG_TAG, "Hey SmartAssist is listening")
      listenSoon(0)
    }
    return START_STICKY
  }

  /** False once the phone's offline recogniser has said it can't do the language. */
  private var useOnDevice = true

  private fun createRecognizer(): SpeechRecognizer =
    if (useOnDevice && Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
      SpeechRecognizer.createOnDeviceSpeechRecognizer(this) // works offline, keeps speech on the phone
    } else {
      SpeechRecognizer.createSpeechRecognizer(this)
    }.apply { setRecognitionListener(listener) }

  /**
   * The offline recogniser is there but its language pack isn't downloaded,
   * so use the normal one. (We don't ask Android to download the 60 MB pack:
   * that pops up a box every time, which would confuse older users.)
   */
  private fun switchToNormalRecognizer() {
    useOnDevice = false
    Log.i(LOG_TAG, "Hey SmartAssist: offline speech pack missing, using the normal recogniser")
  }

  private fun recognizerIntent() =
    Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
      .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      // Only the offline recogniser should insist on offline; the normal one may use the internet.
      .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, useOnDevice)
      .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)

  private fun listenSoon(delayMs: Long) {
    main.removeCallbacksAndMessages(null)
    main.postDelayed(::listenOnce, delayMs)
  }

  private fun listenOnce() {
    if (stopped) return
    if (assistantBusy()) {
      listenSoon(BUSY_RETRY_MS) // SmartAssist is talking or listening for a command
      return
    }
    recognizer?.startListening(recognizerIntent())
  }

  private fun assistantBusy(): Boolean {
    val reader = SmartAssistReaderService.running
    return VoiceActivity.isOpen || reader == null || reader.isTalking()
  }

  private val listener = object : RecognitionListener {
    override fun onResults(results: Bundle?) {
      val heard = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
      handle(heard)
      listenSoon(RESTART_MS)
    }

    override fun onError(error: Int) {
      // "Heard nothing" and "timed out" are normal between commands; just listen again.
      // For anything else, start afresh after a short rest.
      val routine = error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
      val languageMissing = error == ERROR_LANGUAGE_NOT_SUPPORTED || error == ERROR_LANGUAGE_UNAVAILABLE
      if (languageMissing && useOnDevice) {
        switchToNormalRecognizer()
      }
      if (!routine) {
        Log.w(LOG_TAG, "Hey SmartAssist recogniser error $error")
        recognizer?.destroy()
        recognizer = createRecognizer()
      }
      listenSoon(if (routine) RESTART_MS else ERROR_RETRY_MS)
    }

    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}
    override fun onPartialResults(partialResults: Bundle?) {}
    override fun onEvent(eventType: Int, params: Bundle?) {}
  }

  /** "hey smart assist open whatsapp" → carries out "open whatsapp"; just "hey smart assist" → asks for a command. */
  private fun handle(heard: String) {
    val text = VoiceCommands.normalize(heard)
    val wake = wakeWords.map { VoiceCommands.normalize(it) }.firstOrNull { text.contains(it) } ?: return
    val command = text.substringAfter(wake).trim()
    Log.i(LOG_TAG, "Wake words heard: \"$heard\"")
    val reader = SmartAssistReaderService.running ?: return
    if (command.isEmpty()) reader.listen() else reader.carryOut(command)
  }

  private fun showNotification() {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL, "Hey SmartAssist", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Shows while SmartAssist listens for \"Hey SmartAssist\"."
        },
      )
    }
    val turnOff = PendingIntent.getService(
      this, 0, Intent(this, WakeWordService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
    )
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle("Listening for \"Hey SmartAssist\"")
      .setContentText("Say \"Hey SmartAssist\", then your command.")
      .setOngoing(true)
      .addAction(
        Notification.Action.Builder(
          Icon.createWithResource(this, android.R.drawable.ic_menu_close_clear_cancel), "Turn off", turnOff,
        ).build(),
      )
      .build()
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  /** Stops the current listen so someone else can use the microphone; tries again once they're done. */
  private fun yield() {
    recognizer?.cancel()
    listenSoon(BUSY_RETRY_MS)
  }

  override fun onDestroy() {
    stopped = true
    isRunning = false
    if (instance === this) instance = null
    main.removeCallbacksAndMessages(null)
    recognizer?.destroy()
    recognizer = null
    Log.i(LOG_TAG, "Hey SmartAssist stopped")
    super.onDestroy()
  }

  companion object {
    private const val LOG_TAG = "SmartAssistReader"
    private const val CHANNEL = "hey_smartassist"
    private const val NOTIFICATION_ID = 7
    private const val ACTION_STOP = "stop"
    private const val PREFS_FILE = "smartassist_screen_reader"
    private const val KEY_WANTED = "heySmartAssist"
    private const val RESTART_MS = 250L
    private const val BUSY_RETRY_MS = 1000L
    private const val ERROR_RETRY_MS = 2000L

    // SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED and ERROR_LANGUAGE_UNAVAILABLE (Android 12+).
    private const val ERROR_LANGUAGE_NOT_SUPPORTED = 12
    private const val ERROR_LANGUAGE_UNAVAILABLE = 13

    /** True while it is listening. */
    var isRunning = false
      private set

    private var instance: WakeWordService? = null

    /**
     * Call before the Listening card or SmartAssist's voice uses the
     * microphone or speaker: wake-word listening steps aside until they finish.
     */
    fun yieldMicrophone() {
      instance?.yield()
    }

    /**
     * Starts listening. Must be called while SmartAssist is on screen, or
     * Android refuses. Returns false if it couldn't start.
     */
    fun start(context: Context): Boolean = try {
      setWanted(context, true)
      val intent = Intent(context, WakeWordService::class.java)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
      true
    } catch (e: Exception) {
      Log.w(LOG_TAG, "Hey SmartAssist could not start: $e")
      false
    }

    fun stop(context: Context) {
      setWanted(context, false)
      context.stopService(Intent(context, WakeWordService::class.java))
    }

    /** Whether the user turned it on, so the app can start it again after the phone restarts. */
    fun isWanted(context: Context): Boolean =
      context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE).getBoolean(KEY_WANTED, false)

    private fun setWanted(context: Context, wanted: Boolean) {
      context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE).edit().putBoolean(KEY_WANTED, wanted).apply()
    }
  }
}
