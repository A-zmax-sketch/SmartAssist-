package expo.modules.screenreader

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * SmartAssist's voice commands, loaded from assets/voice-commands.json.
 *
 * Follows exactly the same rules as src/services/voiceCommands.ts, whose
 * tests check every example in the JSON file.
 */
class VoiceCommands(json: JSONObject) {
  /** What was asked, e.g. action "openApp" with values {app=telegram}. */
  data class Match(val action: String, val values: Map<String, String>)

  private class Pattern(val action: String, val messenger: String?, val regex: Regex, val names: List<String>)

  private val patterns: List<Pattern>
  private val messengers: Map<String, List<String>>
  val defaultMessenger: String = json.getString("defaultMessenger")

  /** What starts "Hey SmartAssist" listening, e.g. "hey smart assist". */
  val wakeWords: List<String> = json.getJSONArray("wakeWords").toList()
  private val yesWords = json.getJSONArray("yesWords").toList()
  private val noWords = json.getJSONArray("noWords").toList()
  private val replies = json.getJSONObject("replies")

  init {
    val list = mutableListOf<Pattern>()
    val commands = json.getJSONArray("commands")
    for (i in 0 until commands.length()) {
      val command = commands.getJSONObject(i)
      val action = command.getString("action")
      val messenger = command.optString("messenger").ifEmpty { null }
      for (pattern in command.getJSONArray("patterns").toList()) {
        val (regex, names) = patternToRegex(pattern)
        list.add(Pattern(action, messenger, regex, names))
      }
    }
    patterns = list

    val messengerJson = json.getJSONObject("messengers")
    messengers = messengerJson.keys().asSequence().associateWith { messengerJson.getJSONArray(it).toList() }
  }

  /** The first command whose pattern fits the heard words, or null. */
  fun match(heard: String): Match? {
    val text = normalize(heard)
    for (pattern in patterns) {
      val found = pattern.regex.matchEntire(text) ?: continue
      val values = mutableMapOf<String, String>()
      pattern.names.forEachIndexed { i, name -> values[name] = found.groupValues[i + 1].trim() }
      if (pattern.messenger != null && values["messenger"] == null) {
        values["messenger"] = pattern.messenger
      }
      return Match(pattern.action, values)
    }
    return null
  }

  /** "whats app" → "whatsapp"; null for a messenger SmartAssist can't use. */
  fun messengerKey(spoken: String?): String? {
    if (spoken == null) return defaultMessenger
    val word = normalize(spoken)
    return messengers.entries.firstOrNull { (key, words) -> key == word || words.any { normalize(it) == word } }?.key
  }

  /** "yes", "no" or null. "No" wins if both appear, so "no, don't send it" is a no. */
  fun yesOrNo(heard: String): String? {
    val text = " ${normalize(heard)} "
    fun has(words: List<String>) = words.any { text.contains(" ${normalize(it)} ") }
    return when {
      has(noWords) -> "no"
      has(yesWords) -> "yes"
      else -> null
    }
  }

  /** A reply with its placeholders filled in, e.g. reply("opening", "app" to "WhatsApp"). */
  fun reply(key: String, vararg values: Pair<String, String>): String {
    var text = replies.optString(key)
    values.forEach { (name, value) -> text = text.replace("{$name}", value) }
    return text
  }

  companion object {
    fun load(context: Context): VoiceCommands =
      context.assets.open("voice-commands.json").bufferedReader().use { VoiceCommands(JSONObject(it.readText())) }

    /** Lower case, straight apostrophes, no punctuation, tidy spaces. */
    fun normalize(heard: String): String =
      heard.lowercase()
        .replace(Regex("[’‘]"), "'")
        .replace(Regex("[^\\p{L}\\p{N}' ]"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()

    /** "open {app}" → ^open (.+?)$ and the names ["app"]. */
    fun patternToRegex(pattern: String): Pair<Regex, List<String>> {
      val names = mutableListOf<String>()
      val source = StringBuilder()
      var rest = pattern
      val placeholder = Regex("\\{(\\w+)\\}")
      while (true) {
        val found = placeholder.find(rest) ?: break
        if (found.range.first > 0) source.append(Regex.escape(rest.substring(0, found.range.first)))
        source.append("(.+?)")
        names.add(found.groupValues[1])
        rest = rest.substring(found.range.last + 1)
      }
      if (rest.isNotEmpty()) source.append(Regex.escape(rest))
      return Regex("^$source$") to names
    }
  }
}

private fun JSONArray.toList(): List<String> = (0 until length()).map { getString(it) }
