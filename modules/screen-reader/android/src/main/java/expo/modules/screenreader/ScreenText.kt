package expo.modules.screenreader

import android.os.Build
import android.view.accessibility.AccessibilityNodeInfo

/** What kind of thing a line describes. Used for the "3 buttons" summary. */
enum class Kind { TEXT, HEADING, BUTTON, TEXT_BOX, CHECKBOX, SWITCH, PICTURE, LIST }

/** One thing to say, e.g. "Button: Send". */
data class ScreenLine(val text: String, val kind: Kind)

/**
 * Turns the screen of the app the user is looking at into lines to speak,
 * following the reading rules.
 *
 * Android describes a screen as a tree of "nodes": every piece of text,
 * button, picture and box is one. This walks the tree from top to bottom
 * (the order TalkBack reads in) and says what each thing is.
 */
class ScreenText(private val rules: ReadingRules) {

  /** All the lines for one screen, in reading order. */
  fun linesFor(root: AccessibilityNodeInfo?): List<ScreenLine> {
    val lines = mutableListOf<ScreenLine>()
    if (root != null) {
      collect(root, lines, depth = 0)
    }
    return lines
  }

  /** The opening sentence, e.g. "WhatsApp. 5 buttons, 1 text box and 1 list." */
  fun summaryFor(appName: String, lines: List<ScreenLine>): String {
    val opening = rules.summaryOpening.replace("{app}", appName)
    val counts = listOf(
      "button" to lines.count { it.kind == Kind.BUTTON },
      "textBox" to lines.count { it.kind == Kind.TEXT_BOX },
      "list" to lines.count { it.kind == Kind.LIST },
    )
      .filter { (_, n) -> n > 0 }
      .map { (key, n) -> rules.summaryCount(key, n) }

    if (counts.isEmpty()) {
      return opening
    }
    val joined = if (counts.size == 1) {
      counts[0]
    } else {
      counts.dropLast(1).joinToString(", ") + " ${rules.phrase("and")} " + counts.last()
    }
    return "$opening $joined."
  }

  private fun collect(node: AccessibilityNodeInfo, out: MutableList<ScreenLine>, depth: Int) {
    if (depth > MAX_DEPTH || !node.isVisibleToUser) return
    val app = node.packageName?.toString()
    if (app != null && app in rules.skipApps) return

    val kind = kindOf(node)

    if (kind == Kind.TEXT_BOX) {
      add(out, textBoxLine(node), kind)
      return
    }

    if (isAction(kind)) {
      // A button's name is its own label or, for a row like a chat in a list,
      // the text inside it ("Mum, Are you home?, 10:42").
      val parts = mutableListOf<String>()
      gatherText(node, parts, depth + 1)
      val label = labelOf(node).ifEmpty { parts.joinToString(", ") }
      val tooMuch = labelOf(node).isEmpty() && parts.size > MAX_MERGED_PARTS
      if (!tooMuch) {
        if (label.isNotEmpty() || !rules.skipUnlabelledButtons) {
          add(out, actionLine(node, kind, label), kind)
        }
        // Buttons inside this one (e.g. a Delete button in a list row) get their own line.
        forEachChild(node) { collectActionsOnly(it, out, depth + 1) }
        return
      }
      // A whole page that happens to be tappable: read it piece by piece instead.
    } else if (kind == Kind.LIST) {
      val rows = node.collectionInfo?.rowCount ?: 0
      val line = if (rows > 0) "${rules.role("list")}, ${rules.listItemCount(rows)}" else rules.role("list")
      add(out, line, kind)
    } else {
      val label = labelOf(node)
      if (label.isNotEmpty()) {
        when (kind) {
          Kind.HEADING -> add(out, "${rules.role("heading")}: $label", kind)
          Kind.PICTURE -> add(out, "${rules.role("picture")}: $label", kind)
          else -> addText(out, label)
        }
      }
    }

    forEachChild(node) { collect(it, out, depth + 1) }
  }

  /** Inside a button: skip the text (already part of its name) but still find other buttons. */
  private fun collectActionsOnly(node: AccessibilityNodeInfo, out: MutableList<ScreenLine>, depth: Int) {
    if (depth > MAX_DEPTH || !node.isVisibleToUser) return
    val kind = kindOf(node)
    if (kind == Kind.TEXT_BOX || isAction(kind)) {
      collect(node, out, depth)
    } else {
      forEachChild(node) { collectActionsOnly(it, out, depth + 1) }
    }
  }

  /** The text inside a button, leaving out any buttons nested in it. */
  private fun gatherText(node: AccessibilityNodeInfo, parts: MutableList<String>, depth: Int) {
    forEachChild(node) { child ->
      if (depth > MAX_DEPTH || !child.isVisibleToUser) return@forEachChild
      val kind = kindOf(child)
      if (kind == Kind.TEXT_BOX || isAction(kind)) return@forEachChild
      val label = labelOf(child)
      if (label.isNotEmpty() && parts.lastOrNull() != label) {
        parts.add(label)
      }
      gatherText(child, parts, depth + 1)
    }
  }

  private fun kindOf(node: AccessibilityNodeInfo): Kind {
    val type = node.className?.toString() ?: ""
    return when {
      node.isEditable || type.endsWith("EditText") -> Kind.TEXT_BOX
      type.endsWith("Switch") || type.endsWith("SwitchCompat") || type.endsWith("ToggleButton") -> Kind.SWITCH
      node.isCheckable -> Kind.CHECKBOX
      Build.VERSION.SDK_INT >= 28 && node.isHeading -> Kind.HEADING
      node.collectionInfo != null -> Kind.LIST
      type.endsWith("Button") || node.isClickable -> Kind.BUTTON
      type.endsWith("ImageView") || type.endsWith("Image") -> Kind.PICTURE
      else -> Kind.TEXT
    }
  }

  private fun isAction(kind: Kind) = kind == Kind.BUTTON || kind == Kind.CHECKBOX || kind == Kind.SWITCH

  private fun actionLine(node: AccessibilityNodeInfo, kind: Kind, label: String): String {
    val role = when (kind) {
      Kind.CHECKBOX -> rules.role("checkbox")
      Kind.SWITCH -> rules.role("switch")
      else -> rules.role("button")
    }
    val named = if (label.isEmpty()) role else "$role: $label"
    return when (kind) {
      Kind.CHECKBOX -> "$named, ${rules.state(if (isTicked(node)) "ticked" else "notTicked")}"
      Kind.SWITCH -> "$named, ${rules.state(if (isTicked(node)) "on" else "off")}"
      else -> named
    }
  }

  /** Whether a tick box or switch is on. Android 16 replaced isChecked with getChecked(). */
  @Suppress("DEPRECATION")
  private fun isTicked(node: AccessibilityNodeInfo): Boolean =
    if (Build.VERSION.SDK_INT >= 36) {
      node.getChecked() == AccessibilityNodeInfo.CHECKED_STATE_TRUE
    } else {
      node.isChecked
    }

  private fun textBoxLine(node: AccessibilityNodeInfo): String {
    val hint = if (Build.VERSION.SDK_INT >= 26) clean(node.hintText) else ""
    val name = hint.ifEmpty { clean(node.contentDescription) }
    val typed = clean(node.text).takeIf { it != hint } ?: ""
    val value = when {
      typed.isEmpty() -> rules.state("empty")
      node.isPassword -> rules.state("hidden")
      else -> typed
    }
    val role = rules.role("textBox")
    return if (name.isEmpty()) "$role, $value" else "$role: $name, $value"
  }

  /** A node's own name: its description for screen readers, or else its text. */
  private fun labelOf(node: AccessibilityNodeInfo): String =
    clean(node.contentDescription).ifEmpty { clean(node.text) }

  /** Adds plain text, cut into sentences if it is long, so Next skips a sentence at a time. */
  private fun addText(out: MutableList<ScreenLine>, text: String) {
    if (text.length <= MAX_LINE_LENGTH) {
      add(out, text, Kind.TEXT)
    } else {
      splitSentences(text).forEach { add(out, it, Kind.TEXT) }
    }
  }

  private fun add(out: MutableList<ScreenLine>, text: String, kind: Kind) {
    if (text.isBlank() || out.lastOrNull()?.text == text) return // no empty or repeated lines
    out.add(ScreenLine(text, kind))
  }

  private inline fun forEachChild(node: AccessibilityNodeInfo, action: (AccessibilityNodeInfo) -> Unit) {
    for (i in 0 until node.childCount) {
      node.getChild(i)?.let(action)
    }
  }

  companion object {
    /** Stop going deeper than this, in case an app's screen is unusually nested. */
    const val MAX_DEPTH = 60

    /** A tappable area holding more pieces of text than this is a page, not a button. */
    const val MAX_MERGED_PARTS = 6

    /** Longer text is split into sentences. */
    const val MAX_LINE_LENGTH = 300

    fun clean(text: CharSequence?): String = text?.toString()?.replace(Regex("\\s+"), " ")?.trim() ?: ""

    /** Same idea as splitIntoSentences in src/services/speech.ts. */
    fun splitSentences(text: String): List<String> =
      text.replace(Regex("([.!?…]+[\"'”’)\\]]*)\\s+"), "$1\n")
        .split('\n')
        .map { it.trim() }
        .filter { it.isNotEmpty() }
  }
}
