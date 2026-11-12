package expo.modules.screenreader

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.provider.ContactsContract
import android.telephony.SmsManager
import android.telephony.TelephonyManager
import java.text.DateFormat
import java.util.Date

/**
 * The things SmartAssist's voice assistant can do on the phone: open apps,
 * find contacts, send WhatsApp and text messages, make calls, and tell the
 * time, date and battery level. Owner: Kosisochukwu.
 */
class PhoneActions(private val context: Context) {
  data class App(val name: String, val packageName: String)
  data class Contact(val name: String, val number: String)

  fun hasPermission(permission: String): Boolean =
    context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

  // ---- Apps ----------------------------------------------------------------

  /** The installed app whose name best fits what was said, e.g. "whats app" → WhatsApp. */
  fun findApp(spoken: String): App? {
    val wanted = simplify(spoken.removePrefix("the "))
    if (wanted.isEmpty()) return null
    val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val apps = context.packageManager.queryIntentActivities(launcher, 0).map {
      App(it.loadLabel(context.packageManager).toString(), it.activityInfo.packageName)
    }
    return apps.firstOrNull { simplify(it.name) == wanted }
      ?: apps.firstOrNull { simplify(it.name).startsWith(wanted) }
      ?: apps.firstOrNull { simplify(it.name).contains(wanted) }
  }

  fun openApp(app: App): Boolean {
    val intent = context.packageManager.getLaunchIntentForPackage(app.packageName) ?: return false
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    return true
  }

  fun isInstalled(packageName: String): Boolean = try {
    context.packageManager.getPackageInfo(packageName, 0)
    true
  } catch (e: PackageManager.NameNotFoundException) {
    false
  }

  // ---- Contacts ------------------------------------------------------------

  /** The contact whose name best fits what was said. Needs the Contacts permission. */
  fun findContact(spoken: String): Contact? {
    val wanted = simplify(spoken)
    val contacts = mutableListOf<Contact>()
    val columns = arrayOf(
      ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
      ContactsContract.CommonDataKinds.Phone.NUMBER,
    )
    context.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, columns, null, null, null)
      ?.use { cursor ->
        while (cursor.moveToNext()) {
          val name = cursor.getString(0) ?: continue
          val number = cursor.getString(1) ?: continue
          contacts.add(Contact(name, number))
        }
      }
    return contacts.firstOrNull { simplify(it.name) == wanted }
      ?: contacts.firstOrNull { simplify(it.name).startsWith(wanted) }
      ?: contacts.firstOrNull { simplify(it.name).split(" ").contains(wanted) }
      ?: contacts.firstOrNull { simplify(it.name).contains(wanted) }
  }

  // ---- Messages and calls --------------------------------------------------

  /** WhatsApp's package if installed (normal first, then Business), else null. */
  fun whatsAppPackage(): String? = listOf("com.whatsapp", "com.whatsapp.w4b").firstOrNull { isInstalled(it) }

  /**
   * Opens the WhatsApp chat with the message already typed, using WhatsApp's
   * official link (https://wa.me/<number>?text=<message>).
   */
  fun openWhatsAppChat(packageName: String, number: String, message: String): Boolean {
    val uri = Uri.parse("https://wa.me/${internationalDigits(number)}?text=${Uri.encode(message)}")
    val intent = Intent(Intent.ACTION_VIEW, uri).setPackage(packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
      context.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
  }

  /** Sends a text message. Needs the SMS permission. */
  fun sendSms(number: String, message: String): Boolean = try {
    @Suppress("DEPRECATION")
    val sms = if (Build.VERSION.SDK_INT >= 31) context.getSystemService(SmsManager::class.java) else SmsManager.getDefault()
    sms.sendMultipartTextMessage(number, null, sms.divideMessage(message), null, null)
    true
  } catch (e: Exception) {
    false
  }

  /** Rings a number. Needs the Phone permission. */
  fun call(number: String): Boolean = try {
    context.startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:${Uri.encode(number)}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    true
  } catch (e: Exception) {
    false
  }

  // ---- Answers -------------------------------------------------------------

  fun timeNow(): String = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date())

  fun dateToday(): String = DateFormat.getDateInstance(DateFormat.FULL).format(Date())

  fun batteryPercent(): Int =
    (context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)

  // ---- Helpers -------------------------------------------------------------

  /**
   * WhatsApp wants the full international number, digits only. A local number
   * like 0803 123 4567 gets the country code of the phone's SIM (234 in Nigeria).
   */
  fun internationalDigits(number: String): String {
    val trimmed = number.trim()
    val digits = trimmed.filter { it.isDigit() }
    return when {
      trimmed.startsWith("+") -> digits
      digits.startsWith("00") -> digits.drop(2)
      digits.startsWith("0") -> (countryCode() ?: "") + digits.drop(1)
      else -> digits
    }
  }

  private fun countryCode(): String? {
    val telephony = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
    val country = (telephony?.simCountryIso?.ifEmpty { null } ?: telephony?.networkCountryIso)?.lowercase()
    return COUNTRY_CODES[country]
  }

  private fun simplify(text: String): String = VoiceCommands.normalize(text).replace("'", "")

  companion object {
    val PERMISSION_CONTACTS = Manifest.permission.READ_CONTACTS
    val PERMISSION_SMS = Manifest.permission.SEND_SMS
    val PERMISSION_CALL = Manifest.permission.CALL_PHONE

    /** Calling codes for countries where local numbers start with 0. */
    private val COUNTRY_CODES = mapOf(
      "ng" to "234", "gh" to "233", "ke" to "254", "za" to "27", "gb" to "44", "ie" to "353",
      "in" to "91", "fr" to "33", "de" to "49", "ae" to "971", "eg" to "20", "cm" to "237",
    )
  }
}
