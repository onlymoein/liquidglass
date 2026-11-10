package expo.modules.liquidglass

import android.content.Context
import android.view.MotionEvent
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
 * slider moves the slider, not the page.
 */
class TrackView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val density = resources.displayMetrics.density

  /** Whether it takes a finger: a disabled control doesn't. */
  var follows = true

  /** Where the finger came down, in points from the control's left and top. */
  private val onTrackStart by EventDispatcher()
  /** Where the finger is, and how far it's come, in points. Every move. */
  private val onTrack by EventDispatcher()
  /** Where the finger lifted, or that the touch was taken away. */
  private val onTrackEnd by EventDispatcher()

  private var startX = 0f
  private var startY = 0f
  private var tracking = false

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
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        tracking = true
        startX = x
        startY = y
        // The page doesn't scroll under a held control, and a JavaScript touch handler round it
        // lets go, as when a native scroll view takes a touch.
        parent?.requestDisallowInterceptTouchEvent(true)
        NativeGestureUtil.notifyNativeGestureStarted(this, event)
        onTrackStart(mapOf("x" to x, "y" to y))
        onTrack(mapOf("x" to x, "y" to y, "dx" to 0f, "dy" to 0f))
      }
      MotionEvent.ACTION_MOVE -> if (tracking) {
        onTrack(mapOf("x" to x, "y" to y, "dx" to x - startX, "dy" to y - startY))
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> if (tracking) {
        tracking = false
        parent?.requestDisallowInterceptTouchEvent(false)
        NativeGestureUtil.notifyNativeGestureEnded(this, event)
        onTrackEnd(mapOf("x" to x, "dx" to x - startX, "cancelled" to (event.actionMasked == MotionEvent.ACTION_CANCEL)))
      }
    }
    return true
  }
}
