package expo.modules.screenreader

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo

/**
 * SmartAssist's voice assistant on Android: "open WhatsApp", "send a message
 * to Mum saying I'm on my way", "call Mum", "what time is it", and so on.
 * Owner: Kosisochukwu.
 *
 * It hears through the Listening card (VoiceActivity), understands the words
 * with voice-commands.json, and does the job with PhoneActions. Anything that
 * sends a message or makes a call is read back first and only happens after
 * the user says "yes".
 */
class VoiceAssistant(
  private val firstService: AccessibilityService,
  private val speak: (text: String, onDone: (() -> Unit)?) -> Unit,
  private val readScreen: () -> Unit,
) {
  private val commands = VoiceCommands.load(firstService)

  /** The reader running now. Android may have restarted it since this command began. */
  private val service: AccessibilityService
    get() = SmartAssistReaderService.running ?: firstService
  private val phone: PhoneActions
    get() = PhoneActions(service)
  private val main = Handler(Looper.getMainLooper())

  /** The Speak button: listen for one command and carry it out. */
  fun listen() {
    VoiceActivity.listen(service, commands.reply("listening")) { result ->
      when (result) {
        is VoiceResult.Heard -> carryOut(result.text)
        VoiceResult.NothingHeard -> say(commands.reply("notHeard"))
        VoiceResult.NoPermission -> say(commands.reply("needMicrophone"))
        VoiceResult.Cancelled -> Unit
      }
    }
  }

  /** Does what the words ask. Public so it can be tested without a microphone. */
  fun carryOut(heard: String) {
    Log.i(LOG_TAG, "Heard: $heard")
    val match = commands.match(heard)
    if (match == null) {
      say(commands.reply("notUnderstood"))
      return
    }
    val values = match.values
    when (match.action) {
      "openApp" -> openApp(values["app"].orEmpty())
      "sendMessage" -> sendMessage(values["contact"].orEmpty(), values["message"].orEmpty(), values["messenger"])
      "call" -> call(values["contact"].orEmpty())
      // Wait for the Listening card to close, so the app underneath is the one read.
      "readScreen" -> main.postDelayed({ readScreen() }, AFTER_CARD_CLOSES_MS)
      "time" -> say(commands.reply("time", "time" to phone.timeNow()))
      "date" -> say(commands.reply("date", "date" to phone.dateToday()))
      "battery" -> say(commands.reply("battery", "percent" to phone.batteryPercent().toString()))
      "help" -> say(commands.reply("help"))
      else -> say(commands.reply("notUnderstood"))
    }
  }

  private fun openApp(name: String) {
    val app = phone.findApp(name)
    if (app == null) {
      say(commands.reply("noApp", "app" to titleCase(name)))
      return
    }
    say(commands.reply("opening", "app" to app.name))
    phone.openApp(app)
  }

  private fun sendMessage(contactName: String, message: String, spokenMessenger: String?) {
    val messenger = commands.messengerKey(spokenMessenger)
    if (messenger == null) {
      say(commands.reply("unsupportedMessenger", "messenger" to titleCase(spokenMessenger.orEmpty())))
      return
    }
    withPermission(PhoneActions.PERMISSION_CONTACTS, commands.reply("needContacts", "contact" to titleCase(contactName))) {
      val contact = phone.findContact(contactName)
      if (contact == null) {
        say(commands.reply("noContact", "contact" to titleCase(contactName)))
        return@withPermission
      }
      val text = message.replaceFirstChar { it.uppercase() }
      val messengerName = if (messenger == "sms") "text message" else "WhatsApp"
      val question = commands.reply("confirmMessage", "message" to text, "contact" to contact.name, "messenger" to messengerName)
      confirm(question) { yes ->
        when {
          !yes -> say(commands.reply("cancelled"))
          messenger == "sms" -> withPermission(PhoneActions.PERMISSION_SMS, commands.reply("needSms")) {
            if (phone.sendSms(contact.number, text)) {
              say(commands.reply("sent", "contact" to contact.name))
            } else {
              say(commands.reply("notUnderstood"))
            }
          }
          else -> sendOnWhatsApp(contact, text)
        }
      }
    }
  }

  private fun sendOnWhatsApp(contact: PhoneActions.Contact, text: String) {
    val app = phone.whatsAppPackage()
    if (app == null) {
      say(commands.reply("noMessenger", "messenger" to "WhatsApp"))
      return
    }
    if (!phone.openWhatsAppChat(app, contact.number, text)) {
      say(commands.reply("noMessenger", "messenger" to "WhatsApp"))
      return
    }
    pressSendWhenReady(app, attempt = 0) { pressed ->
      say(commands.reply(if (pressed) "sent" else "pressSend", "contact" to contact.name))
    }
  }

  /**
   * WhatsApp opens the chat with the message typed in. Wait for it, then press
   * its Send button. Gives up after about 8 seconds and asks the user to press it.
   */
  private fun pressSendWhenReady(app: String, attempt: Int, done: (Boolean) -> Unit) {
    val root = service.rootInActiveWindow
    if (root != null && root.packageName?.toString() == app) {
      val sendButton = root.findAccessibilityNodeInfosByViewId("$app:id/send").firstOrNull()
        ?: root.findAccessibilityNodeInfosByText("Send").firstOrNull {
          it.contentDescription?.toString().equals("Send", ignoreCase = true)
        }
      if (sendButton != null && click(sendButton)) {
        Log.i(LOG_TAG, "Pressed Send in $app")
        done(true)
        return
      }
    }
    if (attempt >= SEND_ATTEMPTS) {
      done(false)
      return
    }
    main.postDelayed({ pressSendWhenReady(app, attempt + 1, done) }, SEND_RETRY_MS)
  }

  /** Taps a button, or the nearest tappable thing around it. */
  private fun click(node: AccessibilityNodeInfo): Boolean {
    var target: AccessibilityNodeInfo? = node
    while (target != null && !target.isClickable) target = target.parent
    return target?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
  }

  private fun call(contactName: String) {
    withPermission(PhoneActions.PERMISSION_CONTACTS, commands.reply("needContacts", "contact" to titleCase(contactName))) {
      val contact = phone.findContact(contactName)
      if (contact == null) {
        say(commands.reply("noContact", "contact" to titleCase(contactName)))
        return@withPermission
      }
      confirm(commands.reply("confirmCall", "contact" to contact.name)) { yes ->
        if (!yes) {
          say(commands.reply("cancelledCall"))
          return@confirm
        }
        withPermission(PhoneActions.PERMISSION_CALL, commands.reply("needPhone")) {
          // Say it first: once the call starts, the phone call takes over the sound.
          say(commands.reply("calling", "contact" to contact.name)) { phone.call(contact.number) }
        }
      }
    }
  }

  /**
   * Asks a yes-or-no question out loud, then listens for the answer.
   * Anything but a clear "yes" counts as no, so nothing is sent by mistake.
   */
  private fun confirm(question: String, then: (Boolean) -> Unit) {
    say(question) {
      VoiceActivity.listen(service, commands.reply("confirmListening")) { result ->
        val answer = (result as? VoiceResult.Heard)?.let { commands.yesOrNo(it.text) }
        Log.i(LOG_TAG, "Answer: $result → $answer")
        then(answer == "yes")
      }
    }
  }

  /** Runs `then` once the permission is granted, asking for it first if needed. */
  private fun withPermission(permission: String, explanation: String, then: () -> Unit) {
    if (phone.hasPermission(permission)) {
      then()
      return
    }
    VoiceActivity.askPermissions(service, explanation, arrayOf(permission)) { result ->
      if (result is VoiceResult.Heard) then() else say(explanation)
    }
  }

  private fun say(text: String, onDone: (() -> Unit)? = null) = speak(text, onDone)

  /** "aunty ngozi" → "Aunty Ngozi": speech arrives in lower case, but names sound and look better capitalised. */
  private fun titleCase(words: String) = words.split(" ").joinToString(" ") { it.replaceFirstChar(Char::uppercase) }

  private companion object {
    const val LOG_TAG = "SmartAssistReader"
    const val AFTER_CARD_CLOSES_MS = 700L
    const val SEND_RETRY_MS = 500L
    const val SEND_ATTEMPTS = 16
  }
}
