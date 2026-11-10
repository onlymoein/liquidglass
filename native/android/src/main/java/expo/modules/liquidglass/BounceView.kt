package expo.modules.liquidglass

import android.content.Context
import android.view.MotionEvent
import android.view.View
import android.widget.ScrollView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sign

/**
 * Holds a scroll view and makes its ends bounce as iOS's do, in place of Android's stretch.
 *
 * Dragged past an end, the content follows the finger less and less, as if on a rubber band, and
 * springs back when let go. Flung into an end, it carries on past it by as much as it was going,
 * and springs back. The scroll view tells this view about drags it can't use through Android's
 * nested scrolling; flings are watched as the scroll position changes.
 */
class BounceView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  /** How far the finger has gone past the end, in pixels: positive past the top. */
  private var pull = 0f
  /** How far the content is out of place, in pixels: positive when it's moved down. */
  private var offset = 0f
  private var velocity = 0f
  private var touching = false
  private var springing = false
  private var lastFrame = 0L
  private var lastScroll = 0L
  private var speed = 0f

  private val scroller: ScrollView? get() = getChildAt(0) as? ScrollView
  private val content: View? get() = scroller?.getChildAt(0)

  override fun onViewAdded(child: View) {
    super.onViewAdded(child)
    if (child is ScrollView) {
      child.overScrollMode = View.OVER_SCROLL_NEVER
      child.isNestedScrollingEnabled = true
      child.setOnScrollChangeListener { _, _, y, _, oldY -> scrolled(y, oldY) }
    }
  }

  override fun onViewRemoved(child: View) {
    if (child is ScrollView) child.setOnScrollChangeListener(null)
    super.onViewRemoved(child)
  }

  override fun onDetachedFromWindow() {
    springing = false
    offset = 0f
    pull = 0f
    place()
    super.onDetachedFromWindow()
  }

  // React Native sizes and places the children itself. Expo's views are LinearLayouts
  // underneath, which would otherwise measure them again and stack them.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

  // The rubber band iOS uses: the further past the end, the less the content follows, and it
  // never gets further than the scroll view is tall.
  private fun band(x: Float): Float {
    val d = max(height.toFloat(), 1f)
    return sign(x) * (1f - 1f / (abs(x) * 0.55f / d + 1f)) * d
  }

  private fun unband(y: Float): Float {
    val d = max(height.toFloat(), 1f)
    val a = min(abs(y), d * 0.99f)
    return sign(y) * d / 0.55f * (1f / (1f - a / d) - 1f)
  }

  private fun place() {
    content?.translationY = offset
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_DOWN) {
      touching = true
      // A finger catches content that's springing back, where it is.
      springing = false
      velocity = 0f
      pull = unband(offset)
    }
    val handled = super.dispatchTouchEvent(event)
    if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) {
      touching = false
      if (offset != 0f && !springing) spring(0f)
    }
    return handled
  }

  override fun onStartNestedScroll(child: View, target: View, axes: Int): Boolean =
    axes and View.SCROLL_AXIS_VERTICAL != 0

  override fun onNestedScrollAccepted(child: View, target: View, axes: Int) = Unit

  override fun onStopNestedScroll(target: View) = Unit

  // Moving back toward the content first takes up what was pulled past the end.
  override fun onNestedPreScroll(target: View, dx: Int, dy: Int, consumed: IntArray) {
    if (!touching) return
    val used = when {
      pull > 0f && dy > 0 -> min(dy, ceil(pull).toInt())
      pull < 0f && dy < 0 -> max(dy, -ceil(-pull).toInt())
      else -> return
    }
    pull = if (pull > 0f) max(0f, pull - used) else min(0f, pull - used)
    consumed[1] = used
    offset = band(pull)
    place()
  }

  // What the scroll view couldn't scroll, at an end, pulls the content past it.
  override fun onNestedScroll(target: View, dxConsumed: Int, dyConsumed: Int, dxUnconsumed: Int, dyUnconsumed: Int) {
    if (!touching || dyUnconsumed == 0) return
    pull -= dyUnconsumed
    offset = band(pull)
    place()
  }

  // Let go while past an end, the content springs back rather than flinging.
  override fun onNestedPreFling(target: View, velocityX: Float, velocityY: Float): Boolean {
    if (offset == 0f) return false
    spring(0f)
    return true
  }

  override fun onNestedFling(target: View, velocityX: Float, velocityY: Float, consumed: Boolean) = false

  private fun scrolled(y: Int, oldY: Int) {
    val now = System.nanoTime()
    val dt = (now - lastScroll) / 1e9f
    lastScroll = now
    val before = speed
    speed = if (dt in 0.001f..0.1f) {
      val step = (y - oldY) / dt
      if (before == 0f) step else before * 0.4f + step * 0.6f
    } else {
      0f
    }
    if (touching || springing || offset != 0f) return
    val view = scroller ?: return
    val range = max(0, (content?.height ?: 0) - (view.height - view.paddingTop - view.paddingBottom))
    // The step that reaches the end is cut short there, so the speed before it counts too.
    val going = if (abs(before) > abs(speed)) before else speed
    val fast = MIN_SPEED * resources.displayMetrics.density
    if (y <= 0 && oldY > 0 && going < -fast) spring(-going)
    else if (y >= range && oldY < range && going > fast) spring(-going)
  }

  private fun spring(from: Float) {
    val most = MAX_SPEED * resources.displayMetrics.density
    velocity = from.coerceIn(-most, most)
    springing = true
    lastFrame = System.nanoTime()
    postOnAnimation(frame)
  }

  // A critically damped spring back to rest: it doesn't overshoot, as iOS's bounce doesn't.
  private val frame = object : Runnable {
    override fun run() {
      if (!springing) return
      val now = System.nanoTime()
      val dt = ((now - lastFrame) / 1e9f).coerceIn(0f, 0.05f)
      lastFrame = now
      val h = dt / 4f
      repeat(4) {
        val accel = -STIFFNESS * STIFFNESS * offset - 2f * STIFFNESS * velocity
        velocity += accel * h
        offset += velocity * h
      }
      if (abs(offset) < 0.5f && abs(velocity) < 20f) {
        offset = 0f
        velocity = 0f
        springing = false
      }
      place()
      if (springing) postOnAnimation(this)
    }
  }

  private companion object {
    /** The spring's natural frequency, per second: back to rest in about half a second. */
    const val STIFFNESS = 11f
    /** A fling slower than this, in points a second, stops at the end without bouncing. */
    const val MIN_SPEED = 150f
    /** The fastest a fling carries past the end, in points a second. */
    const val MAX_SPEED = 2600f
  }
}
