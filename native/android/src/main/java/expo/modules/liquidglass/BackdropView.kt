package expo.modules.liquidglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderNode
import android.os.Build
import android.view.View
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
  internal val content: RenderNode? = if (Build.VERSION.SDK_INT >= 31) RenderNode("liquidglass-backdrop") else null
  private val watchers: MutableSet<View> = Collections.newSetFromMap(WeakHashMap())

  init {
    // Android skips draw() for a view group with nothing of its own to draw, which here would
    // leave the recording empty.
    setWillNotDraw(false)
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
