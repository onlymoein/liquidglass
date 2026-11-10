package expo.modules.liquidglass

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.Choreographer
import android.view.ViewTreeObserver
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

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
  /**
   * A lens over frosted glass, as the tab bar's is: it shows what's behind frosted as the bar
   * does, enlarged, and still bends and parts the colours at its rim.
   */
  var frosted = false
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
  /**
   * A tab bar's selection at rest: the bar's glass under it, a little darker and richer, as iOS
   * 27 deepens the colour behind the selected tab rather than greying it. No rim, no bend.
   */
  var selection = false
    set(value) { field = value; changed() }
  /** How much a lens enlarges what's under it: 1 for glass that doesn't. */
  var zoom = 1f
    set(value) { field = value; changed() }
  /** How far a lens parts the colours at its rim, as a share of its bend: 0 for none. */
  var split = 0f
    set(value) { field = value; changed() }

  /**
   * Shows the outermost backdrop behind it rather than the nearest: a menu over the page shows
   * the page, glass and all, not just the circles behind one card.
   */
  var outermost = false
    set(value) { field = value; backdrop?.unwatch(this); backdrop = null; changed() }

  /**
   * Where it grows out of, in points from where it's laid out, as a menu grows out of its button:
   * left, top, width and height. It swells from there into its own shape when it's first laid out,
   * rounder than it ends, and folds back into it when it's no longer `open`. What's in it is
   * drawn at its full size, stretched with it, and comes into focus as it gets there.
   */
  var growFrom: RectF? = null
  /**
   * Whether it starts as it's asked to be, open or folded, rather than growing when it's first
   * laid out, and stays in sight folded: a tab bar that shrinks to one tab and back.
   */
  var stays = false
  /** Whether it's grown out, or folded back into where it came from. */
  var open = true
    set(value) {
      if (field == value) return
      field = value
      if (grown) morphTo(if (value) 1f else 0f)
    }
  /** Tells the app it has folded back into where it came from. */
  private val onFolded by EventDispatcher()
  private var grown = false
  private var morph = 1f
  private var speed = 0f
  private var target = 1f
  private var lastFrame = 0L
  private var morphing = false
  /** Where React Native laid it out, which is where it grows to. */
  private val laid = Rect()
  private val tick = Choreographer.FrameCallback { now -> step(now) }

  /**
   * What's behind stays as it is while this is up, as the page under an open menu does. So it
   * takes a picture of what's on the screen behind it once, and bends that, rather than drawing
   * the page again every frame, other glass and all.
   */
  var still = false
  private var picture: Bitmap? = null
  private val pictureAt = Rect()
  private var asked = false
  private val window = IntArray(2)

  private var backdrop: BackdropView? = null
  /** Tells the app, once, that this glass found no backdrop to show, so it can say why it's plain. */
  private val onBackdropMissing by EventDispatcher()
  private var missing = false
  private val node: RenderNode? = if (Build.VERSION.SDK_INT >= 31) RenderNode("liquidglass-glass") else null
  /** What's behind, blurred at a quarter of the size: a blur that wide looks the same, for a sixteenth of the work. */
  private val small: RenderNode? = if (Build.VERSION.SDK_INT >= 31) RenderNode("liquidglass-blur") else null
  private val shrink: Int get() = if (blur >= 4f) 4 else 1
  private var effectFor = ""
  /** The shader, kept as Any so the class still loads before Android 13. */
  private var compiled: Any? = null
  private val shape = Path()
  private val fallback = Paint(Paint.ANTI_ALIAS_FLAG)
  private val step = Matrix()
  /** Takes the backdrop's points to this glass's own, scale and all. */
  private val fromBackdrop = Matrix()

  private val follow = ViewTreeObserver.OnPreDrawListener {
    // Before its first frame, while the screen still shows what's behind it.
    if (still && isLaidOut) takePicture()
    // Glass that moves, or grows, over its backdrop has to draw again to show what's now behind
    // it. Which backdrop is behind depends on where the glass is, so it's found once it's laid out.
    if (backdrop == null && isLaidOut && width > 0) {
      backdrop = Backdrops.behind(this, outermost)?.also { it.watch(this) }
      if (backdrop == null && !missing) {
        missing = true
        onBackdropMissing(mapOf())
      }
    }
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
    get() {
      val most = min(width, height) / 2f
      if (growFrom == null || morph >= 1f) return min(cornerRadius * density, most)
      // Round as a drop while it grows, and its own shape only once it's nearly there.
      val round = max(0f, morph).pow(4)
      return min(most + (cornerRadius * density - most) * round, most)
    }

  /** Whether a group draws this glass, as part of its one surface. */
  private val grouped: Boolean
    get() = (parent as? GlassGroupView)?.carries(this) == true

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(follow)
    if (Build.VERSION.SDK_INT >= 33) Tilt.watch(this, this)
  }

  override fun onDetachedFromWindow() {
    picture?.recycle()
    picture = null
    asked = false
    Choreographer.getInstance().removeFrameCallback(tick)
    morphing = false
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

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    laid.set(left, top, right, bottom)
    if (growFrom == null) return
    if (!grown) {
      grown = true
      speed = 0f
      if (stays) {
        morph = if (open) 1f else 0f
        target = morph
      } else {
        morph = 0f
        morphTo(if (open) 1f else 0f)
      }
    }
    shape()
  }

  /** Copies what's on the screen round where this will be, before it's first drawn. */
  private fun takePicture() {
    if (asked || Build.VERSION.SDK_INT < 31 || laid.isEmpty || !isAttachedToWindow) return
    val surface = appContext.currentActivity?.window ?: return
    asked = true
    // Where it's laid out and where it grows from, with room for the rim and blur to reach, on
    // the screen.
    getLocationInWindow(window)
    val box = Rect(laid)
    growFrom?.let {
      box.union(
        Rect(
          laid.left + (it.left * density).toInt(), laid.top + (it.top * density).toInt(),
          laid.left + (it.right * density).toInt(), laid.top + (it.bottom * density).toInt()
        )
      )
    }
    box.offset(window[0] - left, window[1] - top)
    val reach = marginPx() + (max(laid.width(), laid.height()) * 0.06f).toInt()
    box.inset(-reach, -reach)
    val root = rootView
    if (!box.intersect(0, 0, root.width, root.height)) return
    val copy = Bitmap.createBitmap(box.width(), box.height(), Bitmap.Config.ARGB_8888)
    pictureAt.set(box)
    PixelCopy.request(surface, box, copy, { result ->
      if (result == PixelCopy.SUCCESS && isAttachedToWindow) {
        picture = copy.copy(Bitmap.Config.HARDWARE, false)
        invalidate()
      }
      copy.recycle()
    }, Handler(Looper.getMainLooper()))
  }

  // The springs iOS 27's menus open and close with, as stiffness and damping for a unit mass.
  private fun morphTo(value: Float) {
    target = value
    if (morphing) return
    morphing = true
    lastFrame = 0L
    Choreographer.getInstance().postFrameCallback(tick)
  }

  private fun step(now: Long) {
    if (!morphing) return
    val dt = if (lastFrame == 0L) 1f / 60f else ((now - lastFrame) / 1e9f).coerceIn(0.001f, 0.032f)
    lastFrame = now
    val stiffness = if (target > 0f) 320f else 620f
    val damping = if (target > 0f) 27f else 47f
    repeat(4) {
      speed += (-stiffness * (morph - target) - damping * speed) * (dt / 4f)
      morph += speed * (dt / 4f)
    }
    if (abs(morph - target) < 0.002f && abs(speed) < 0.02f) {
      morph = target
      morphing = false
      shape()
      if (target == 0f) onFolded(mapOf())
      return
    }
    shape()
    Choreographer.getInstance().postFrameCallback(tick)
  }

  /** Takes the size and place it's got to, between where it grows from and where it was laid out. */
  private fun shape() {
    val from = growFrom ?: return
    if (laid.isEmpty) return
    val t = morph
    // A little ahead in height.
    val tall = if (t >= 1f) t else 1f - (1f - t).pow(1.6f)
    val fromLeft = laid.left + from.left * density
    val fromTop = laid.top + from.top * density
    val w = max(1f, from.width() * density + (laid.width() - from.width() * density) * t)
    val h = max(1f, from.height() * density + (laid.height() - from.height() * density) * tall)
    val x = fromLeft + (laid.left - fromLeft) * t
    val y = fromTop + (laid.top - fromTop) * tall
    val l = Math.round(x)
    val top = Math.round(y)
    if (Build.VERSION.SDK_INT >= 29) setLeftTopRightBottom(l, top, l + Math.round(w), top + Math.round(h))
    else { left = l; this.top = top; right = l + Math.round(w); bottom = top + Math.round(h) }
    // At the very end of folding back, what it came from takes over.
    alpha = if (target == 0f && !stays) (t / 0.12f).coerceIn(0f, 1f) else 1f
    effectFor = ""
    invalidate()
    (parent as? android.view.View)?.invalidate()
  }

  override fun dispatchDraw(canvas: Canvas) {
    if (width > 0 && height > 0) {
      Shapes.outline(shape, width.toFloat(), height.toFloat(), radiusPx)
      if (!lens && !selection && tint == null && (parent as? GlassGroupView)?.drawsShadows != true) {
        Shapes.drawShadow(canvas, shape, width.toFloat(), height.toFloat(), radiusPx, short, density, dark)
      }
      if (!grouped) drawGlass(canvas)
    }
    val from = growFrom
    if (from == null || laid.isEmpty || morph >= 1f && !morphing) {
      super.dispatchDraw(canvas)
      return
    }
    // What's in it, laid out at its full size, stretched to the drop and coming into focus.
    val t = morph
    val focus = if (target > 0f) ((t - 0.45f) / 0.4f).coerceIn(0f, 1f) else ((t - 0.7f) / 0.3f).coerceIn(0f, 1f)
    if (focus <= 0f) return
    canvas.save()
    canvas.scale(width / laid.width().toFloat(), height / laid.height().toFloat())
    canvas.saveLayerAlpha(0f, 0f, laid.width().toFloat(), laid.height().toFloat(), (focus * 255).toInt())
    super.dispatchDraw(canvas)
    canvas.restore()
    canvas.restore()
  }

  private fun drawGlass(canvas: Canvas) {
    val source = backdrop?.content
    val glass = node
    val still = picture
    if ((source == null && still == null) || glass == null || !canvas.isHardwareAccelerated) {
      fallback.color = tint ?: if (dark) Color.argb(184, 40, 40, 44) else Color.argb(184, 255, 255, 255)
      canvas.drawPath(shape, fallback)
      return
    }

    val q = shrink
    val blurNode = small
    val apart = q > 1 && blurNode != null
    // The blur gathers from further out than the rim reaches. Blurred apart, at a quarter of the
    // size, only the rim's reach is drawn round the glass at full size.
    val blurMargin = marginPx()
    val margin = if (apart) rimMarginPx() else blurMargin
    glass.setPosition(0, 0, width + margin * 2, height + margin * 2)
    updateEffect(glass, margin)
    val target = if (apart) blurNode!! else glass
    if (apart) target.setPosition(0, 0, (width + blurMargin * 2 + q - 1) / q, (height + blurMargin * 2 + q - 1) / q)
    val recording = target.beginRecording()
    if (apart) recording.scale(1f / q, 1f / q)
    recording.translate(blurMargin.toFloat(), blurMargin.toFloat())
    if (still != null) {
      getLocationInWindow(window)
      recording.drawBitmap(still, (pictureAt.left - window[0]).toFloat(), (pictureAt.top - window[1]).toFloat(), null)
    } else {
      recording.concat(fromBackdrop)
      recording.drawRenderNode(source!!)
    }
    target.endRecording()
    if (apart) {
      val up = glass.beginRecording()
      up.translate((margin - blurMargin).toFloat(), (margin - blurMargin).toFloat())
      up.scale(q.toFloat(), q.toFloat())
      up.drawRenderNode(target)
      glass.endRecording()
    }

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
  private val bezel: Float get() = if (selection) 0f else if (lens) (short * 0.12f).coerceIn(4f, 10f) else (2.4f + short * 0.059f).coerceIn(3f, 12f)
  private val reach: Float get() = if (lens) (short * 0.2f).coerceIn(8f, 24f) else min(short * 0.33f, 48f)
  /** How much of the size curve applies: none at 60 points tall or less, all of it at 120. */
  private val size: Float get() = ((short - 60f) / 60f).coerceIn(0f, 1f)
  /** The blur's standard deviation, in points. */
  private val blur: Float get() = if (lens && !frosted) 0f else if (clear) 1.3f else 15.3f

  // Room round the glass for the rim to reach into and the blur to gather from. Two deviations
  // hold all but a sliver of a blur's weight.
  private fun marginPx(): Int = ((reach + blur * 2f) * density).toInt() + 2
  /** Room for the rim alone: how far its bend reaches, and the hairline just outside. */
  private fun rimMarginPx(): Int = (reach * density).toInt() + 4

  private fun updateEffect(glass: RenderNode, margin: Int) {
    val key = "$width-$height-$margin-$cornerRadius-$radiusPx-$clear-$dark-$tint-$zoom-$split-$lens-$frosted-$selection-$prominent-$held-$touch-${if (lens || selection) 0 else Tilt.version}"
    if (key == effectFor) return
    effectFor = key
    if (Build.VERSION.SDK_INT < 31) return

    // RenderEffect takes a radius and turns it into a deviation as radius * 0.57735 + 0.5.
    val q = shrink
    val radius = max(0f, (blur * density / q - 0.5f) / 0.57735f)
    val blurred = if (radius > 0f) RenderEffect.createBlurEffect(radius, radius, Shader.TileMode.CLAMP) else null
    // Blurred small, in its own node, or here at full size.
    small?.setRenderEffect(if (q > 1) blurred else null)
    val here = if (q > 1) null else blurred
    if (Build.VERSION.SDK_INT < 33) {
      glass.setRenderEffect(here)
      return
    }

    val light = !dark
    fun lerp(a: Float, b: Float) = a + (b - a) * size
    val (contrast, glassBrightness, glassSaturation) = when {
      lens && !frosted -> Triple(1f, 1f, 1f)
      clear -> Triple(0.793f, 1.205f, 1.117f)
      light -> Triple(lerp(0.314f, 0.307f), lerp(1.511f, 1.554f), lerp(2f, 2.081f))
      else -> Triple(lerp(0.68f, 0.66f), lerp(0.98f, 0.83f), lerp(1.6f, 1.7f))
    }
    // The selection's darker, richer tone after the glass's own, as the web version measured on
    // iOS: brightness 0.89 and saturation 1.39 in light mode, 0.75 and 1.7 in dark. Brightness and
    // saturation each pass through the other, so they fold into the glass's.
    val brightness = glassBrightness * if (!selection) 1f else if (dark) 0.75f else 0.89f
    val saturation = glassSaturation * if (!selection) 1f else if (dark) 1.7f else 1.39f
    // Made once: making one compiles the shader, which takes longer than a frame on a phone.
    val shader = (compiled as RuntimeShader?) ?: RuntimeShader(GLASS_SHADER).also { compiled = it }
    shader.setFloatUniform("size", width.toFloat(), height.toFloat())
    shader.setFloatUniform("margin", margin.toFloat())
    shader.setFloatUniform("radius", radiusPx)
    shader.setFloatUniform("bezel", bezel * density)
    shader.setFloatUniform("reach", reach * density)
    shader.setFloatUniform("density", density)
    shader.setFloatUniform("contrast", contrast)
    shader.setFloatUniform("brightness", brightness)
    shader.setFloatUniform("saturation", saturation)
    shader.setFloatUniform("shine", if (selection) 0f else if (lens && !frosted) 0.6f else 1f)
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
    glass.setRenderEffect(if (here != null) RenderEffect.createChainEffect(bent, here) else bent)
  }
}
