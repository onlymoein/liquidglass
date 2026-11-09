package expo.modules.liquidglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.max
import kotlin.math.min

/**
 * A pane of Liquid Glass. It finds the backdrop behind it and draws it again, bent at the rim,
 * blurred and toned, then draws its own children on top.
 *
 * Full glass needs Android 13, for the shader. Android 12 gets the blur and tone without the
 * bend, and anything older a translucent pane.
 */
class GlassView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val density = resources.displayMetrics.density

  /** Corner radius in points, as React Native gives it. */
  var cornerRadius = 0f
    set(value) { field = value; changed() }
  var clear = false
    set(value) { field = value; changed() }
  var dark = false
    set(value) { field = value; changed() }
  var tint: Int? = null
    set(value) { field = value; changed() }

  private var backdrop: BackdropView? = null
  private val node: RenderNode? = if (Build.VERSION.SDK_INT >= 31) RenderNode("liquidglass-glass") else null
  private var effectFor = ""
  private val shape = Path()
  private val fallback = Paint(Paint.ANTI_ALIAS_FLAG)
  private val here = IntArray(2)
  private val there = IntArray(2)
  private var offsetX = 0
  private var offsetY = 0

  private val follow = ViewTreeObserver.OnPreDrawListener {
    // Glass that moves over its backdrop has to draw again to show what's now behind it.
    val source = backdrop
    if (source != null) {
      getLocationInWindow(here)
      source.getLocationInWindow(there)
      val x = here[0] - there[0]
      val y = here[1] - there[1]
      if (x != offsetX || y != offsetY) {
        offsetX = x
        offsetY = y
        invalidate()
      }
    }
    true
  }

  init {
    setWillNotDraw(false)
    clipChildren = false
  }

  private fun changed() {
    effectFor = ""
    invalidate()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    backdrop = findBackdrop()?.also { it.watch(this) }
    viewTreeObserver.addOnPreDrawListener(follow)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(follow)
    backdrop?.unwatch(this)
    backdrop = null
    super.onDetachedFromWindow()
  }

  /**
   * The backdrop drawn before this glass and nearest to it: a sibling of the glass or of one of
   * its ancestors, or something inside one, that comes earlier and so lies behind.
   */
  private fun findBackdrop(): BackdropView? {
    var child: View = this
    var parent = child.parent
    while (parent is ViewGroup) {
      val index = parent.indexOfChild(child)
      for (i in index - 1 downTo 0) {
        search(parent.getChildAt(i))?.let { return it }
      }
      child = parent
      parent = parent.parent
    }
    return null
  }

  private fun search(view: View): BackdropView? {
    if (view is BackdropView) return view
    if (view is GlassView || view !is ViewGroup) return null
    for (i in view.childCount - 1 downTo 0) search(view.getChildAt(i))?.let { return it }
    return null
  }

  private val radiusPx: Float
    get() = min(cornerRadius * density, min(width, height) / 2f)

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    effectFor = ""
  }

  // React Native sizes and places the children itself. Expo's views are LinearLayouts
  // underneath, which would otherwise measure them again, squeezing text, and stack them.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

  override fun dispatchDraw(canvas: Canvas) {
    if (width > 0 && height > 0) drawGlass(canvas)
    super.dispatchDraw(canvas)
  }

  private fun drawGlass(canvas: Canvas) {
    shape.reset()
    val r = radiusPx
    shape.addRoundRect(0f, 0f, width.toFloat(), height.toFloat(), r, r, Path.Direction.CW)

    val source = backdrop?.content
    val glass = node
    if (source == null || glass == null || !canvas.isHardwareAccelerated) {
      fallback.color = tint ?: if (dark) Color.argb(184, 40, 40, 44) else Color.argb(184, 255, 255, 255)
      canvas.drawPath(shape, fallback)
      return
    }

    val margin = marginPx()
    glass.setPosition(0, 0, width + margin * 2, height + margin * 2)
    updateEffect(glass, margin)
    val recording = glass.beginRecording()
    recording.translate((margin - offsetX).toFloat(), (margin - offsetY).toFloat())
    recording.drawRenderNode(source)
    glass.endRecording()

    canvas.save()
    canvas.clipPath(shape)
    canvas.translate(-margin.toFloat(), -margin.toFloat())
    canvas.drawRenderNode(glass)
    canvas.restore()
  }

  // The values below follow the web version's styles.css and refraction.ts, in points.

  private val short: Float get() = min(width, height) / density
  private val bezel: Float get() = (2.4f + short * 0.059f).coerceIn(3f, 12f)
  private val reach: Float get() = min(short * 0.33f, 48f)
  /** How much of the size curve applies: none at 60 points tall or less, all of it at 120. */
  private val size: Float get() = ((short - 60f) / 60f).coerceIn(0f, 1f)
  /** The blur's standard deviation, in points. */
  private val blur: Float get() = if (clear) 1.3f else 15.3f

  private fun marginPx(): Int = ((reach + blur * 3f) * density).toInt() + 2

  private fun updateEffect(glass: RenderNode, margin: Int) {
    val key = "$width-$height-$margin-$cornerRadius-$clear-$dark-$tint"
    if (key == effectFor) return
    effectFor = key
    if (Build.VERSION.SDK_INT < 31) return

    // RenderEffect takes a radius and turns it into a deviation as radius * 0.57735 + 0.5.
    val radius = max(0f, (blur * density - 0.5f) / 0.57735f)
    val blurred = RenderEffect.createBlurEffect(radius, radius, Shader.TileMode.CLAMP)
    if (Build.VERSION.SDK_INT < 33) {
      glass.setRenderEffect(blurred)
      return
    }

    val light = !dark
    fun lerp(a: Float, b: Float) = a + (b - a) * size
    val (contrast, brightness, saturation) = when {
      clear -> Triple(0.793f, 1.205f, 1.117f)
      light -> Triple(lerp(0.314f, 0.307f), lerp(1.511f, 1.554f), lerp(2f, 2.081f))
      else -> Triple(lerp(0.68f, 0.66f), lerp(0.98f, 0.83f), lerp(1.6f, 1.7f))
    }
    val shader = RuntimeShader(GLASS_SHADER)
    shader.setFloatUniform("size", width.toFloat(), height.toFloat())
    shader.setFloatUniform("margin", margin.toFloat())
    shader.setFloatUniform("radius", radiusPx)
    shader.setFloatUniform("bezel", bezel * density)
    shader.setFloatUniform("reach", reach * density)
    shader.setFloatUniform("density", density)
    shader.setFloatUniform("contrast", contrast)
    shader.setFloatUniform("brightness", brightness)
    shader.setFloatUniform("saturation", saturation)
    shader.setFloatUniform("shine", if (clear) 2.1f else 1f)
    if (dark) shader.setFloatUniform("base", 0f, 0f, 0f) else shader.setFloatUniform("base", 1f, 1f, 1f)
    val t = tint
    if (t != null) {
      shader.setFloatUniform("tint", Color.red(t) / 255f, Color.green(t) / 255f, Color.blue(t) / 255f, Color.alpha(t) / 255f)
    } else {
      shader.setFloatUniform("tint", 0f, 0f, 0f, 0f)
    }
    val bent = RenderEffect.createRuntimeShaderEffect(shader, "content")
    glass.setRenderEffect(RenderEffect.createChainEffect(bent, blurred))
  }
}
