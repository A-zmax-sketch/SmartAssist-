package expo.modules.screenreader

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * SmartAssist's reading instructions, loaded from assets/reading-rules.json.
 * The team can change the words in that file without touching Kotlin.
 */
class ReadingRules(json: JSONObject) {
  /** Apps whose text is never read, such as the status bar. */
  val skipApps: Set<String> = json.getJSONArray("skipApps").toStringList().toSet()

  /** Skip buttons that have no name, instead of saying just "Button". */
  val skipUnlabelledButtons: Boolean = json.getBoolean("skipUnlabelledButtons")

  /** Stop reading when the user opens another screen, instead of reading the old one. */
  val stopWhenScreenChanges: Boolean = json.getBoolean("stopWhenScreenChanges")

  private val roles = json.getJSONObject("roles").toStringMap()
  private val states = json.getJSONObject("states").toStringMap()
  private val phrases = json.getJSONObject("phrases").toStringMap()

  private val summary = json.getJSONObject("summary")
  val summaryEnabled: Boolean = summary.getBoolean("enabled")
  val summaryOpening: String = summary.getString("opening")
  private val summaryCounts = summary.getJSONObject("counts")
  private val listItems = json.getJSONArray("listItems")

  /** What a kind of thing is called, e.g. role("button") → "Button". */
  fun role(key: String): String = roles[key] ?: key

  /** A state word, e.g. state("ticked") → "ticked". */
  fun state(key: String): String = states[key] ?: key

  /** A fixed phrase, e.g. phrase("endOfScreen") → "End of screen.". */
  fun phrase(key: String): String = phrases[key] ?: ""

  /** A count for the summary, e.g. summaryCount("button", 3) → "3 buttons". */
  fun summaryCount(key: String, n: Int): String = plural(summaryCounts.getJSONArray(key), n)

  /** How many items a list has, e.g. listItemCount(12) → "12 items". */
  fun listItemCount(n: Int): String = plural(listItems, n)

  /** Picks "1 button" or "{n} buttons" from a [one, many] pair. */
  private fun plural(pair: JSONArray, n: Int): String =
    if (n == 1) pair.getString(0) else pair.getString(1).replace("{n}", n.toString())

  companion object {
    fun load(context: Context): ReadingRules =
      context.assets.open("reading-rules.json").bufferedReader().use { reader ->
        ReadingRules(JSONObject(reader.readText()))
      }
  }
}

private fun JSONArray.toStringList(): List<String> = (0 until length()).map { getString(it) }

private fun JSONObject.toStringMap(): Map<String, String> =
  keys().asSequence().associateWith { getString(it) }
