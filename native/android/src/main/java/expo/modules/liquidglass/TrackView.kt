package expo.modules.liquidglass

import android.content.Context
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.ScrollView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import com.facebook.react.uimanager.events.NativeGestureUtil

/**
 * Follows a finger on a control, on the UI thread. A control's thumb or lens is tied to what this
 * reports through React Native's native animation driver, so it moves with the finger in the same
 * frame, however busy the app's JavaScript is. JavaScript hears where the finger is too, for the
 * value and for where it lifts, but nothing on screen waits for it.
 *
 * It takes the touch as soon as the finger is down, as iOS's controls do: a drag that starts on a
 * slider moves the slider, not the page. A patient one, as a menu's button is, waits a moment
 * first when it's in something that scrolls, as iOS's scroll views hold a touch back from what's
 * in them: a quick swipe that starts on it scrolls the page, and a finger that stays is its.
 */
class TrackView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val density = resources.displayMetrics.density

  /** Whether it takes a finger: a disabled control doesn't. */
  var follows = true

  /** Whether it lets a page it's in scroll, if the finger moves off at once. */
  var patient = false

  /** Where the finger came down, in points from the control's left and top. */
  private val onTrackStart by EventDispatcher()
  /** That the touch is this control's: the page under it won't scroll from here on. */
  private val onTrackClaim by EventDispatcher()
  /** Where the finger is, and how far it's come, in points. Every move. */
  private val onTrack by EventDispatcher()
  /** Where the finger lifted, or that the touch was taken away. */
  private val onTrackEnd by EventDispatcher()

  private var startX = 0f
  private var startY = 0f
  private var lastX = 0f
  private var lastY = 0f
  private var tracking = false
  private var claimed = false
  private var down: MotionEvent? = null
  private val claimLater = Runnable { claim() }

  private fun inScroller(): Boolean {
    var view = parent
    while (view is ViewGroup) {
      if (view is ScrollView || view is HorizontalScrollView || view.isScrollContainer) return true
      view = view.parent
    }
    return false
  }

  private fun claim() {
    val event = down ?: return
    if (!tracking || claimed) return
    claimed = true
    // The page doesn't scroll under a held control, and a JavaScript touch handler round it
    // lets go, as when a native scroll view takes a touch.
    parent?.requestDisallowInterceptTouchEvent(true)
    NativeGestureUtil.notifyNativeGestureStarted(this, event)
    onTrackClaim(mapOf("x" to lastX, "y" to lastY))
  }

  private fun release() {
    removeCallbacks(claimLater)
    down?.recycle()
    down = null
  }

  override fun onDetachedFromWindow() {
    release()
    tracking = false
    super.onDetachedFromWindow()
  }

  // React Native sizes and places the children itself. Expo's views are LinearLayouts
  // underneath, which would otherwise measure them again and stack them.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

  override fun onInterceptTouchEvent(event: MotionEvent): Boolean = follows

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (!follows && !tracking) return false
    val x = event.x / density
    val y = event.y / density
    lastX = x
    lastY = y
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        release()
        tracking = true
        claimed = false
        down = MotionEvent.obtain(event)
        startX = x
        startY = y
        onTrackStart(mapOf("x" to x, "y" to y))
        if (patient && inScroller()) postDelayed(claimLater, ViewConfiguration.getTapTimeout().toLong()) else claim()
        onTrack(mapOf("x" to x, "y" to y, "dx" to 0f, "dy" to 0f))
      }
      MotionEvent.ACTION_MOVE -> if (tracking) {
        onTrack(mapOf("x" to x, "y" to y, "dx" to x - startX, "dy" to y - startY))
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> if (tracking) {
        tracking = false
        if (claimed) {
          parent?.requestDisallowInterceptTouchEvent(false)
          NativeGestureUtil.notifyNativeGestureEnded(this, event)
        }
        release()
        onTrackEnd(mapOf("x" to x, "y" to y, "dx" to x - startX, "dy" to y - startY, "cancelled" to (event.actionMasked == MotionEvent.ACTION_CANCEL)))
      }
    }
    return true
  }
}
