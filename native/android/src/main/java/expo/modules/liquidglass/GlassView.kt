package expo.modules.liquidglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
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
class GlassView(context: Context, appContext: AppContext) : ExpoView(context, appContext), Lit {
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
  /**
   * A held thumb, or the tab bar's lens: perfectly clear, neither blurred nor toned, bending at
   * its rim as a lens does.
   */
  var lens = false
    set(value) { field = value; changed() }
  /** A filled button's glass: its tint, darkened a little by what's behind, rather than mixed in. */
  var prominent = false
    set(value) { field = value; changed() }
  /** Whether a finger is on it: iOS lights the rim of glass that's held, as clear glass's is. */
  var held = false
    set(value) { field = value; changed() }
  /** Where the finger is, in points from the top left, for the glow under it; null for none. */
  var touch: Pair<Float, Float>? = null
    set(value) { field = value; changed() }
  /** How much a lens enlarges what's under it: 1 for glass that doesn't. */
  var zoom = 1f
    set(value) { field = value; changed() }
  /** How far a lens parts the colours at its rim, as a share of its bend: 0 for none. */
  var split = 0f
    set(value) { field = value; changed() }

  private var backdrop: BackdropView? = null
  private val node: RenderNode? = if (Build.VERSION.SDK_INT >= 31) RenderNode("liquidglass-glass") else null
  private var effectFor = ""
  private val shape = Path()
  private val fallback = Paint(Paint.ANTI_ALIAS_FLAG)
  private val step = Matrix()
  /** Takes the backdrop's points to this glass's own, scale and all. */
  private val fromBackdrop = Matrix()

  private val follow = ViewTreeObserver.OnPreDrawListener {
    // Glass that moves, or grows, over its backdrop has to draw again to show what's now behind
    // it. Which backdrop is behind depends on where the glass is, so it's found once it's laid out.
    if (backdrop == null && isLaidOut && width > 0) backdrop = Backdrops.behind(this)?.also { it.watch(this) }
    val source = backdrop
    if (source != null && Backdrops.mapping(source, this, step) && step != fromBackdrop) {
      fromBackdrop.set(step)
      invalidate()
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
    (parent as? GlassGroupView)?.invalidate()
  }

  override fun lightMoved() {
    if (!lens) invalidate()
  }

  /** Corner radius in pixels, as drawn. */
  internal val radiusPx: Float
    get() = min(cornerRadius * density, min(width, height) / 2f)

  /** Whether a group draws this glass, as part of its one surface. */
  private val grouped: Boolean
    get() = (parent as? GlassGroupView)?.carries(this) == true

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(follow)
    if (Build.VERSION.SDK_INT >= 33) Tilt.watch(this, this)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(follow)
    Tilt.unwatch(this)
    backdrop?.unwatch(this)
    backdrop = null
    super.onDetachedFromWindow()
  }

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
    if (width > 0 && height > 0) {
      Shapes.outline(shape, width.toFloat(), height.toFloat(), radiusPx)
      if (!lens && tint == null && (parent as? GlassGroupView)?.drawsShadows != true) {
        Shapes.drawShadow(canvas, shape, short, density, dark)
      }
      if (!grouped) drawGlass(canvas)
    }
    super.dispatchDraw(canvas)
  }

  private fun drawGlass(canvas: Canvas) {
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
    recording.translate(margin.toFloat(), margin.toFloat())
    recording.concat(fromBackdrop)
    recording.drawRenderNode(source)
    glass.endRecording()

    canvas.save()
    // From Android 13 the shader draws the edge, and the hairline just outside it. Before, the
    // blur alone needs the shape cut out.
    if (Build.VERSION.SDK_INT < 33) canvas.clipPath(shape)
    canvas.translate(-margin.toFloat(), -margin.toFloat())
    canvas.drawRenderNode(glass)
    canvas.restore()
  }

  // The values below follow the web version's styles.css and refraction.ts, in points.

  internal val short: Float get() = min(width, height) / density
  private val bezel: Float get() = if (lens) (short * 0.12f).coerceIn(4f, 10f) else (2.4f + short * 0.059f).coerceIn(3f, 12f)
  private val reach: Float get() = if (lens) (short * 0.2f).coerceIn(8f, 24f) else min(short * 0.33f, 48f)
  /** How much of the size curve applies: none at 60 points tall or less, all of it at 120. */
  private val size: Float get() = ((short - 60f) / 60f).coerceIn(0f, 1f)
  /** The blur's standard deviation, in points. */
  private val blur: Float get() = if (lens) 0f else if (clear) 1.3f else 15.3f

  // Room round the glass for the rim to reach into and the blur to gather from. Two deviations
  // hold all but a sliver of a blur's weight.
  private fun marginPx(): Int = ((reach + blur * 2f) * density).toInt() + 2

  private fun updateEffect(glass: RenderNode, margin: Int) {
    val key = "$width-$height-$margin-$cornerRadius-$clear-$dark-$tint-$zoom-$split-$lens-$prominent-$held-$touch-${if (lens) 0 else Tilt.version}"
    if (key == effectFor) return
    effectFor = key
    if (Build.VERSION.SDK_INT < 31) return

    // RenderEffect takes a radius and turns it into a deviation as radius * 0.57735 + 0.5.
    val radius = max(0f, (blur * density - 0.5f) / 0.57735f)
    val blurred = if (radius > 0f) RenderEffect.createBlurEffect(radius, radius, Shader.TileMode.CLAMP) else null
    if (Build.VERSION.SDK_INT < 33) {
      glass.setRenderEffect(blurred)
      return
    }

    val light = !dark
    fun lerp(a: Float, b: Float) = a + (b - a) * size
    val (contrast, brightness, saturation) = when {
      lens -> Triple(1f, 1f, 1f)
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
    shader.setFloatUniform("shine", if (lens) 0.6f else 1f)
    shader.setFloatUniform("clear", if ((clear || held) && !lens) 1f else 0f)
    val finger = touch
    if (finger != null) {
      shader.setFloatUniform("glow", finger.first * density, finger.second * density, 1f)
    } else {
      shader.setFloatUniform("glow", 0f, 0f, 0f)
    }
    shader.setFloatUniform("lens", if (lens) 1f else 0f)
    shader.setFloatUniform("prominent", if (prominent && tint != null) 1f else 0f)
    shader.setFloatUniform("zoom", zoom)
    shader.setFloatUniform("split", split)
    shader.setFloatUniform("light", Tilt.x, Tilt.y)
    if (dark) shader.setFloatUniform("base", 0f, 0f, 0f) else shader.setFloatUniform("base", 1f, 1f, 1f)
    val t = tint
    if (t != null) {
      shader.setFloatUniform("tint", Color.red(t) / 255f, Color.green(t) / 255f, Color.blue(t) / 255f, Color.alpha(t) / 255f)
    } else {
      shader.setFloatUniform("tint", 0f, 0f, 0f, 0f)
    }
    val bent = RenderEffect.createRuntimeShaderEffect(shader, "content")
    glass.setRenderEffect(if (blurred != null) RenderEffect.createChainEffect(bent, blurred) else bent)
  }
}
