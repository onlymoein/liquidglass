package expo.modules.liquidglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.RectF
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
import android.view.View
import android.view.ViewTreeObserver
import androidx.annotation.RequiresApi
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.max
import kotlin.math.min

/**
 * Glass that flows together, as in an iOS glass container. The group draws the glass of the
 * pieces directly inside it as one surface, and pieces that come within `spacing` of each other
 * merge, then part again as they move away. Each piece still draws what's on it.
 *
 * Tinted glass and lenses draw themselves, as does every piece before Android 13, since the
 * surface needs the shader.
 */
class GlassGroupView(context: Context, appContext: AppContext) : ExpoView(context, appContext), Lit {
  private val density = resources.displayMetrics.density

  /** Glass closer together than this flows into one shape, in points. */
  var spacing = 20f
    set(value) { field = value; invalidate() }

  private var backdrop: BackdropView? = null
  private val node: RenderNode? = if (Build.VERSION.SDK_INT >= 33) RenderNode("liquidglass-group") else null
  private var shader: RuntimeShader? = null
  private var effectFor = ""
  private val fromBackdrop = Matrix()
  private val step = Matrix()
  private val box = RectF()
  private val rects = FloatArray(MAX * 4)
  private val radii = FloatArray(MAX)
  private var count = 0
  private var placed = ""

  private val follow = ViewTreeObserver.OnPreDrawListener {
    if (backdrop == null && isLaidOut && width > 0) backdrop = Backdrops.behind(this)?.also { it.watch(this) }
    val source = backdrop
    if (source != null && Backdrops.mapping(source, this, step) && step != fromBackdrop) {
      fromBackdrop.set(step)
      invalidate()
    }
    // The pieces can move without the group knowing, as a pressed one swells, so their places
    // are checked before every frame.
    if (source != null && place() != placed) invalidate()
    true
  }

  init {
    setWillNotDraw(false)
    clipChildren = false
  }

  /** Whether this group draws the glass of this piece. */
  internal fun carries(glass: GlassView): Boolean = active && members().contains(glass)

  private val active: Boolean
    get() = Build.VERSION.SDK_INT >= 33 && backdrop != null && isHardwareAccelerated

  private fun members(): List<GlassView> {
    val list = ArrayList<GlassView>(childCount)
    for (i in 0 until childCount) {
      val child = getChildAt(i)
      if (child is GlassView && child.visibility == View.VISIBLE && child.tint == null && !child.lens && list.size < MAX) list.add(child)
    }
    return list
  }

  override fun lightMoved() = invalidate()

  /** Whether the group draws its pieces' shadows, under its surface, rather than each its own. */
  internal val drawsShadows: Boolean
    get() = active

  private val outline = android.graphics.Path()

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

  // React Native sizes and places the children itself. Expo's views are LinearLayouts
  // underneath, which would otherwise measure them again, squeezing text, and stack them.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

  override fun dispatchDraw(canvas: Canvas) {
    if (Build.VERSION.SDK_INT >= 33 && canvas.isHardwareAccelerated && width > 0 && height > 0) drawSurface(canvas)
    super.dispatchDraw(canvas)
  }

  /** Where each piece is now, in the group's own pixels, with a key that says if that changed. */
  private fun place(): String {
    val pieces = members()
    count = pieces.size
    val key = StringBuilder()
    for ((i, piece) in pieces.withIndex()) {
      box.set(0f, 0f, piece.width.toFloat(), piece.height.toFloat())
      piece.matrix.mapRect(box)
      box.offset(piece.left.toFloat(), piece.top.toFloat())
      rects[i * 4] = box.left
      rects[i * 4 + 1] = box.top
      rects[i * 4 + 2] = box.width()
      rects[i * 4 + 3] = box.height()
      radii[i] = min(piece.radiusPx * piece.scaleX, min(box.width(), box.height()) / 2f)
      key.append(box.left.toInt()).append(',').append(box.top.toInt()).append(',')
        .append(box.width().toInt()).append(',').append(box.height().toInt()).append(',').append(radii[i].toInt()).append(';')
    }
    return key.toString()
  }

  @RequiresApi(33)
  private fun drawSurface(canvas: Canvas) {
    val source = backdrop?.content ?: return
    val surface = node ?: return
    placed = place()
    if (count == 0) return
    val pieces = members()

    // Room round the pieces for the rim to reach into and the blur to spread, and for a piece
    // to swell beyond the group as it's pressed.
    val shortest = pieces.minOf { min(it.width, it.height) } / density
    val bezel = (2.4f + shortest * 0.059f).coerceIn(3f, 12f)
    val reach = min(shortest * 0.33f, 48f)
    val first = pieces[0]
    val blur = if (first.clear) 1.3f else 15.3f
    val margin = ((reach + blur * 2f + 24f) * density).toInt()

    surface.setPosition(0, 0, width + margin * 2, height + margin * 2)
    updateEffect(surface, margin, shortest, bezel, reach, blur, first)
    val recording = surface.beginRecording()
    recording.translate(margin.toFloat(), margin.toFloat())
    recording.concat(fromBackdrop)
    recording.drawRenderNode(source)
    surface.endRecording()

    // The pieces' shadows go under the surface, so one piece's doesn't fall on its neighbour.
    for (piece in pieces) {
      Shapes.outline(outline, piece.width.toFloat(), piece.height.toFloat(), piece.radiusPx)
      canvas.save()
      canvas.translate(piece.left.toFloat(), piece.top.toFloat())
      canvas.concat(piece.matrix)
      Shapes.drawShadow(canvas, outline, piece.width.toFloat(), piece.height.toFloat(), piece.radiusPx, piece.short, density, piece.dark)
      canvas.restore()
    }

    canvas.save()
    canvas.translate(-margin.toFloat(), -margin.toFloat())
    canvas.drawRenderNode(surface)
    canvas.restore()
  }

  @RequiresApi(33)
  private fun updateEffect(surface: RenderNode, margin: Int, shortest: Float, bezel: Float, reach: Float, blur: Float, first: GlassView) {
    val key = "$width-$height-$margin-$placed-$spacing-${first.clear}-${first.dark}-${Tilt.version}"
    if (key == effectFor) return
    effectFor = key

    val size = ((shortest - 60f) / 60f).coerceIn(0f, 1f)
    fun lerp(a: Float, b: Float) = a + (b - a) * size
    val (contrast, brightness, saturation) = when {
      first.clear -> Triple(0.793f, 1.205f, 1.117f)
      !first.dark -> Triple(lerp(0.314f, 0.307f), lerp(1.511f, 1.554f), lerp(2f, 2.081f))
      else -> Triple(lerp(0.68f, 0.66f), lerp(0.98f, 0.83f), lerp(1.6f, 1.7f))
    }
    val placedRects = FloatArray(MAX * 4)
    for (i in 0 until count) {
      placedRects[i * 4] = rects[i * 4] + margin
      placedRects[i * 4 + 1] = rects[i * 4 + 1] + margin
      placedRects[i * 4 + 2] = rects[i * 4 + 2]
      placedRects[i * 4 + 3] = rects[i * 4 + 3]
    }
    val s = shader ?: RuntimeShader(GROUP_SHADER).also { shader = it }
    s.setFloatUniform("rects", placedRects)
    s.setFloatUniform("radii", radii)
    s.setFloatUniform("count", count.toFloat())
    s.setFloatUniform("spacing", spacing * density)
    s.setFloatUniform("bezel", bezel * density)
    s.setFloatUniform("reach", reach * density)
    s.setFloatUniform("density", density)
    s.setFloatUniform("contrast", contrast)
    s.setFloatUniform("brightness", brightness)
    s.setFloatUniform("saturation", saturation)
    s.setFloatUniform("shine", 1f)
    s.setFloatUniform("clear", if (first.clear) 1f else 0f)
    if (first.dark) s.setFloatUniform("base", 0f, 0f, 0f) else s.setFloatUniform("base", 1f, 1f, 1f)
    s.setFloatUniform("light", Tilt.x, Tilt.y)

    // The effect takes a copy of the shader's values, so it's made again whenever they change.
    val radius = max(0f, (blur * density - 0.5f) / 0.57735f)
    val bent = RenderEffect.createRuntimeShaderEffect(s, "content")
    val blurred = RenderEffect.createBlurEffect(radius, radius, Shader.TileMode.CLAMP)
    surface.setRenderEffect(RenderEffect.createChainEffect(bent, blurred))
  }

  private companion object {
    /** The most pieces one group draws as one surface; any more draw themselves. */
    const val MAX = 8
  }
}
