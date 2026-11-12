package expo.modules.screenreader

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import kotlin.math.abs

/**
 * The yellow buttons that float over every app while the screen reader is on.
 * Collapsed it is one "Read screen" button; while reading it shows Pause (or
 * Continue), Next and Stop. Drag it to move it; it remembers where it was left.
 *
 * Colours and sizes follow SmartAssist's High-contrast theme: yellow
 * #FFD600 on black, buttons at least 64 dp tall, 22 sp bold words.
 */
class FloatingControls(
  private val context: Context,
  private val onRead: () -> Unit,
  private val onPause: () -> Unit,
  private val onContinue: () -> Unit,
  private val onNext: () -> Unit,
  private val onStop: () -> Unit,
) {
  private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val prefs = context.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)

  private val params = WindowManager.LayoutParams(
    WindowManager.LayoutParams.WRAP_CONTENT,
    WindowManager.LayoutParams.WRAP_CONTENT,
    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
    // Not focusable, so the app underneath keeps the keyboard and stays the one we read.
    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
    PixelFormat.TRANSLUCENT,
  ).apply { gravity = Gravity.TOP or Gravity.START }

  private val panel = DragPanel(context, onDragStart = ::dragStart, onDrag = ::drag, onDragEnd = ::dragEnd).apply {
    orientation = LinearLayout.VERTICAL
    setPadding(dp(8), dp(8), dp(8), dp(8))
    background = rounded(Color.BLACK, Color.parseColor(YELLOW))
  }
  private val readButton = bigButton("Read screen", android.R.drawable.ic_media_play) { onRead() }
  private val pauseButton = bigButton("Pause", android.R.drawable.ic_media_pause) { onPause() }
  private val continueButton = bigButton("Continue", android.R.drawable.ic_media_play) { onContinue() }
  private val nextButton = bigButton("Next", android.R.drawable.ic_media_next) { onNext() }
  private val stopButton = bigButton("Stop", android.R.drawable.ic_menu_close_clear_cancel) { onStop() }
  private val buttons = listOf(readButton, pauseButton, continueButton, nextButton, stopButton)

  private var attached = false
  private var dragStartX = 0
  private var dragStartY = 0

  /** Puts the buttons on screen. Only an accessibility service may do this without extra permission. */
  fun attach() {
    if (attached) return
    buttons.forEach { panel.addView(it) }
    giveButtonsTheSameWidth()
    show(ReaderState.IDLE)

    // Where the user last left it, or the middle of the right edge the first time.
    panel.measure(View.MeasureSpec.UNSPECIFIED, View.MeasureSpec.UNSPECIFIED)
    val screen = context.resources.displayMetrics
    params.x = prefs.getInt(KEY_X, screen.widthPixels - panel.measuredWidth - dp(8))
    params.y = prefs.getInt(KEY_Y, screen.heightPixels / 2 - panel.measuredHeight / 2)
    keepOnScreen()

    windowManager.addView(panel, params)
    attached = true
  }

  fun detach() {
    if (!attached) return
    windowManager.removeView(panel)
    attached = false
  }

  /** Shows the buttons that make sense right now. */
  fun show(state: ReaderState) {
    readButton.visibility = visibleIf(state == ReaderState.IDLE)
    pauseButton.visibility = visibleIf(state == ReaderState.PLAYING)
    continueButton.visibility = visibleIf(state == ReaderState.PAUSED)
    nextButton.visibility = visibleIf(state != ReaderState.IDLE)
    stopButton.visibility = visibleIf(state != ReaderState.IDLE)
    // Growing from one button to three could push it off the bottom of the screen.
    panel.post { moveTo(params.x, params.y) }
  }

  /** Hides the buttons, for example while SmartAssist itself is open. */
  fun setHidden(hidden: Boolean) {
    panel.visibility = visibleIf(!hidden)
  }

  private fun dragStart() {
    dragStartX = params.x
    dragStartY = params.y
  }

  private fun drag(dx: Int, dy: Int) = moveTo(dragStartX + dx, dragStartY + dy)

  private fun dragEnd() {
    prefs.edit().putInt(KEY_X, params.x).putInt(KEY_Y, params.y).apply()
  }

  private fun moveTo(x: Int, y: Int) {
    params.x = x
    params.y = y
    keepOnScreen()
    if (attached) windowManager.updateViewLayout(panel, params)
  }

  private fun keepOnScreen() {
    val screen = context.resources.displayMetrics
    val width = if (panel.width > 0) panel.width else panel.measuredWidth
    val height = if (panel.height > 0) panel.height else panel.measuredHeight
    params.x = params.x.coerceIn(0, maxOf(0, screen.widthPixels - width))
    params.y = params.y.coerceIn(0, maxOf(0, screen.heightPixels - height))
  }

  /** So the panel doesn't change width (and jump) when "Read screen" becomes "Pause". */
  private fun giveButtonsTheSameWidth() {
    val widest = buttons.maxOf { button ->
      button.measure(View.MeasureSpec.UNSPECIFIED, View.MeasureSpec.UNSPECIFIED)
      button.measuredWidth
    }
    buttons.forEach { it.layoutParams.width = widest }
  }

  private fun visibleIf(show: Boolean) = if (show) View.VISIBLE else View.GONE

  private fun bigButton(label: String, icon: Int, onPress: () -> Unit) = Button(context).apply {
    text = label
    contentDescription = label
    isAllCaps = false
    setTextColor(Color.BLACK)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
    setTypeface(typeface, Typeface.BOLD)
    minHeight = dp(64)
    minimumHeight = dp(64)
    minWidth = dp(64)
    minimumWidth = dp(64)
    compoundDrawablePadding = dp(8)
    setPadding(dp(16), dp(8), dp(16), dp(8))
    background = rounded(Color.parseColor(YELLOW), Color.BLACK)
    context.getDrawable(icon)?.mutate()?.let { drawable ->
      drawable.setTint(Color.BLACK)
      setCompoundDrawablesWithIntrinsicBounds(drawable, null, null, null)
    }
    layoutParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply { setMargins(0, dp(4), 0, dp(4)) }
    setOnClickListener { onPress() }
  }

  private fun rounded(fill: Int, stroke: Int) = GradientDrawable().apply {
    setColor(fill)
    cornerRadius = dp(16).toFloat()
    setStroke(dp(2), stroke)
  }

  private fun dp(value: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), context.resources.displayMetrics).toInt()

  companion object {
    const val YELLOW = "#FFD600"

    /** How the panel identifies itself to Android (see DragPanel.getAccessibilityClassName). */
    const val PANEL_CLASS_NAME = "expo.modules.screenreader.FloatingControls"
    private const val PREFS_FILE = "smartassist_screen_reader"
    private const val KEY_X = "panelX"
    private const val KEY_Y = "panelY"
  }
}

/**
 * The panel the buttons sit in. A tap goes to the button under the finger;
 * once the finger moves a little, the whole panel is dragged instead.
 */
@SuppressLint("ViewConstructor")
private class DragPanel(
  context: Context,
  private val onDragStart: () -> Unit,
  private val onDrag: (dx: Int, dy: Int) -> Unit,
  private val onDragEnd: () -> Unit,
) : LinearLayout(context) {
  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private var downX = 0f
  private var downY = 0f
  private var dragging = false

  override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> startTouch(event)
      MotionEvent.ACTION_MOVE -> if (!dragging && movedFar(event)) beginDrag()
    }
    return dragging // true takes the gesture away from the button, so it won't count as a tap
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> startTouch(event)
      MotionEvent.ACTION_MOVE -> {
        if (!dragging && movedFar(event)) beginDrag()
        if (dragging) onDrag((event.rawX - downX).toInt(), (event.rawY - downY).toInt())
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        if (dragging) onDragEnd()
        dragging = false
      }
    }
    return true
  }

  private fun startTouch(event: MotionEvent) {
    downX = event.rawX
    downY = event.rawY
    dragging = false
  }

  private fun movedFar(event: MotionEvent) =
    abs(event.rawX - downX) > touchSlop || abs(event.rawY - downY) > touchSlop

  private fun beginDrag() {
    dragging = true
    onDragStart()
  }

  /**
   * Android reports the panel appearing or changing as a "screen change".
   * This name lets the service recognise its own buttons and ignore them.
   */
  override fun getAccessibilityClassName(): CharSequence = FloatingControls.PANEL_CLASS_NAME
}
