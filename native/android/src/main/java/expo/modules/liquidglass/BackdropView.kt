package expo.modules.liquidglass

import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Picture
import android.graphics.Rect
import android.graphics.RenderNode
import android.os.Build
import android.util.Log
import android.view.View
import android.view.ViewTreeObserver
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.util.Collections
import java.util.WeakHashMap

/**
 * What glass shows. An Android view can't see what's drawn behind it, so this records its
 * children into a display list as it draws them, and glass draws that list again through its
 * shader. The list holds the children's own, so what scrolls or animates inside shows in the
 * glass as it happens.
 *
 * Glass has to sit outside the backdrop it shows, or it would be drawing itself.
 */
class BackdropView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  internal val content: RenderNode? = if (Build.VERSION.SDK_INT >= 31 && !Soft.forced(context)) RenderNode("liquidglass-backdrop") else null
  private val watchers: MutableSet<View> = Collections.newSetFromMap(WeakHashMap())

  init {
    // Android skips draw() for a view group with nothing of its own to draw, which here would
    // leave the recording empty.
    setWillNotDraw(false)
  }

  /**
   * How many times what's in it has changed, for whether its pictures still show it. Android
   * draws only what changed, so a page scrolling in it is drawn again without it: it's checked
   * before each frame instead.
   */
  private var drawn = 0
  private val changes = ViewTreeObserver.OnPreDrawListener {
    if (isDirty) {
      drawn++
      for (glass in watchers.toList()) glass.invalidate()
    }
    true
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (content == null) viewTreeObserver.addOnPreDrawListener(changes)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(changes)
    taken.clear()
    super.onDetachedFromWindow()
  }
  /** A picture of part of it: `left` and `top` are where that part starts, in its own pixels. */
  internal class Taken(val bitmap: Bitmap, val left: Int, val top: Int, val drawn: Int, val sigma: Float)
  private val taken = HashMap<Int, Taken>()
  private var taking = false
  private var failed = -1
  /** Whether it has to be recorded to be drawn into a picture: once it's held a hardware bitmap. */
  private var recorded = false
  private val part = Rect()

  /**
   * Before Android 12 glass can't blur what it shows as it draws it, so it asks for a picture
   * of this backdrop: drawn here at `1 / shrink` of its size, blurred by `sigma` of the
   * picture's pixels, and kept until it's drawn again, for all the glass on it to share. Only
   * what's under its glass is drawn, with as much round it as the blur gathers from and the
   * rim reaches. Null if it can't be drawn into a picture.
   */
  internal fun picture(shrink: Int, sigma: Float): Taken? {
    val kept = taken[shrink]
    // Glass inside this backdrop, drawn into its picture, shows what it showed last.
    if (kept != null && (kept.drawn == drawn && kept.sigma == sigma || taking)) return kept
    if (taking || failed == drawn || width <= 0 || height <= 0) return kept
    if (!under(sigma * shrink * 3f + 40f * resources.displayMetrics.density, part) || !part.intersect(0, 0, width, height)) {
      part.set(0, 0, width, height)
    }
    // On the picture's own grid, so what's behind doesn't shimmer as the glass moves over it.
    val left = part.left / shrink * shrink
    val top = part.top / shrink * shrink
    val w = (part.right - left + shrink - 1) / shrink
    val h = (part.bottom - top + shrink - 1) / shrink
    val bitmap = kept?.bitmap?.takeIf { it.width == w && it.height == h } ?: Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    taking = true
    try {
      if (!recorded) {
        try {
          bitmap.eraseColor(0)
          drawInto(Canvas(bitmap), shrink, left, top)
        } catch (error: IllegalArgumentException) {
          // A hardware bitmap, as an image loaded by Glide can be, which a software canvas can't
          // draw. From Android 9 it can be recorded and drawn on the GPU instead, if more slowly.
          if (Build.VERSION.SDK_INT < 28) throw error
          recorded = true
        }
      }
      if (recorded && Build.VERSION.SDK_INT >= 28) {
        val recording = Picture()
        drawInto(recording.beginRecording(w, h), shrink, left, top)
        recording.endRecording()
        val rendered = Bitmap.createBitmap(recording, w, h, Bitmap.Config.ARGB_8888)
        val readable = if (rendered.config == Bitmap.Config.HARDWARE) rendered.copy(Bitmap.Config.ARGB_8888, false) else rendered
        bitmap.eraseColor(0)
        Canvas(bitmap).drawBitmap(readable, 0f, 0f, null)
        if (readable !== rendered) readable.recycle()
        rendered.recycle()
      }
    } catch (error: RuntimeException) {
      if (failed < 0) Log.w("LiquidGlass", "A backdrop couldn't be drawn for the glass on it: ${error.message}")
      failed = drawn
      return kept
    } finally {
      taking = false
    }
    Plain.blur(bitmap, sigma)
    return Taken(bitmap, left, top, drawn, sigma).also { taken[shrink] = it }
  }

  private fun drawInto(canvas: Canvas, shrink: Int, left: Int, top: Int) {
    canvas.scale(1f / shrink, 1f / shrink)
    canvas.translate(-left.toFloat(), -top.toFloat())
    canvas.clipRect(part)
    draw(canvas)
  }

  private val here = IntArray(2)
  private val there = IntArray(2)
  private val one = Rect()

  /** Sets `out` to where its glass is, in its own pixels, `margin` further out all round. False for none. */
  private fun under(margin: Float, out: Rect): Boolean {
    getLocationInWindow(here)
    out.setEmpty()
    for (glass in watchers) {
      if (!glass.isAttachedToWindow || !glass.isShown) continue
      glass.getLocationInWindow(there)
      val x = there[0] - here[0]
      val y = there[1] - here[1]
      // Glass that grows or swells reaches past where it's laid out.
      val grow = (glass.width * glass.scaleX.coerceAtLeast(1f) - glass.width) / 2f + (glass.height * glass.scaleY.coerceAtLeast(1f) - glass.height) / 2f
      val reach = (margin + grow).toInt()
      one.set(x - reach, y - reach, x + glass.width + reach, y + glass.height + reach)
      out.union(one)
    }
    return !out.isEmpty
  }

  internal fun watch(glass: View) = watchers.add(glass)
  internal fun unwatch(glass: View) = watchers.remove(glass)

  // React Native sizes and places the children itself. Expo's views are LinearLayouts
  // underneath, which would otherwise measure them again, squeezing text, and stack them.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

  // The whole drawing is recorded, background and all, so a switch's track, which is only a
  // background, shows in the thumb's lens.
  override fun draw(canvas: Canvas) {
    val node = content
    if (node == null || !canvas.isHardwareAccelerated) {
      super.draw(canvas)
      return
    }
    node.setPosition(0, 0, width, height)
    val recording = node.beginRecording()
    super.draw(recording)
    node.endRecording()
    canvas.drawRenderNode(node)
    // Glass that shows this redraws with it.
    for (glass in watchers.toList()) glass.invalidate()
  }
}

/**
 * Whether glass is drawn as it is before Android 12, on any Android: for trying that out on a
 * newer phone, in a debug build, with `adb shell setprop debug.liquidglass.plain 1`, before the
 * app starts.
 */
internal object Soft {
  private var asked: Boolean? = null

  fun forced(context: Context): Boolean {
    asked?.let { return it }
    val debuggable = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    val value = debuggable && try {
      Runtime.getRuntime().exec(arrayOf("getprop", "debug.liquidglass.plain")).inputStream.bufferedReader().readText().trim() == "1"
    } catch (_: Exception) {
      false
    }
    asked = value
    return value
  }
}
