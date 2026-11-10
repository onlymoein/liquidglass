package expo.modules.liquidglass

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.util.LruCache
import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/** The shape of glass, and the shadow under it, as the web version measured them on iOS. */
internal object Shapes {
  /** How much further along each edge a continuous corner starts than a circular one would. */
  const val CORNER_REACH = 1.2f
  private const val CORNER_POWER = 2.5f

  /**
   * A rounded rectangle with iOS's continuous corners, or circular ones where a continuous
   * corner wouldn't fit, as on a capsule.
   */
  fun outline(path: Path, width: Float, height: Float, radius: Float) {
    path.reset()
    val r = min(radius, min(width, height) / 2f)
    val reach = r * CORNER_REACH
    if (r <= 0f || reach > min(width, height) / 2f) {
      path.addRoundRect(0f, 0f, width, height, r, r, Path.Direction.CW)
      return
    }
    // Each corner is a superellipse reaching `reach` along both edges, walked from one edge
    // to the other so the outline runs clockwise.
    val steps = 16
    fun corner(cx: Float, cy: Float, sx: Float, sy: Float, backwards: Boolean) {
      for (i in 0..steps) {
        val t = (PI / 2) * (if (backwards) steps - i else i) / steps
        val u = cos(t).coerceAtLeast(0.0).pow(2.0 / CORNER_POWER).toFloat()
        val v = sin(t).coerceAtLeast(0.0).pow(2.0 / CORNER_POWER).toFloat()
        val x = cx + sx * u * reach
        val y = cy + sy * v * reach
        if (path.isEmpty) path.moveTo(x, y) else path.lineTo(x, y)
      }
    }
    corner(width - reach, reach, 1f, -1f, backwards = true)
    corner(width - reach, height - reach, 1f, 1f, backwards = false)
    corner(reach, height - reach, -1f, 1f, backwards = true)
    corner(reach, reach, -1f, -1f, backwards = false)
    path.close()
  }

  private val shadow = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
  private val blurring = Paint(Paint.ANTI_ALIAS_FLAG)
  private val traced = Path()

  // A shadow is the same for every pane of one size, and blurring it is the slow part, so each
  // is blurred once, at a quarter of its size since it's soft anyway, and kept.
  private const val SCALE = 0.25f
  private val shadows = object : LruCache<String, Bitmap>(4 * 1024 * 1024) {
    override fun sizeOf(key: String, value: Bitmap) = value.byteCount
  }

  /**
   * The soft shadow iOS draws under glass, stronger and wider on bigger glass. Like a CSS box
   * shadow, it's only drawn outside the shape, since the glass is see-through.
   */
  fun drawShadow(canvas: Canvas, shape: Path, width: Float, height: Float, radius: Float, short: Float, density: Float, dark: Boolean) {
    if (!canvas.isHardwareAccelerated || width <= 0f || height <= 0f) return
    val size = ((short - 60f) / 60f).coerceIn(0f, 1f)
    val strength = if (dark) 1.6f else 1f
    val alpha = (0.016f + 0.054f * size) * strength
    val offset = (4f + 4f * size) * density
    // A CSS blur radius is twice the deviation.
    val sigma = (8f + 13f * size) / 2f * density
    val pad = ceil(sigma * 3f)
    val key = "${width.toInt()}x${height.toInt()}-${radius.toInt()}-${sigma.toInt()}"
    val image = shadows.get(key) ?: blurred(width, height, radius, sigma, pad).also { shadows.put(key, it) }
    shadow.color = Color.argb((alpha * 255f).toInt().coerceIn(0, 255), 0, 0, 0)
    canvas.save()
    canvas.clipOutPath(shape)
    canvas.translate(-pad, -pad + offset)
    canvas.scale(1f / SCALE, 1f / SCALE)
    canvas.drawBitmap(image, 0f, 0f, shadow)
    canvas.restore()
  }

  private fun blurred(width: Float, height: Float, radius: Float, sigma: Float, pad: Float): Bitmap {
    val image = Bitmap.createBitmap(
      max(1, ceil((width + pad * 2f) * SCALE).toInt()),
      max(1, ceil((height + pad * 2f) * SCALE).toInt()),
      Bitmap.Config.ALPHA_8,
    )
    val drawing = Canvas(image)
    drawing.scale(SCALE, SCALE)
    drawing.translate(pad, pad)
    outline(traced, width, height, radius)
    // A mask filter's radius maps to a deviation of radius * 0.57735 + 0.5, and it's scaled
    // with the canvas.
    blurring.maskFilter = BlurMaskFilter(max(0.1f, (sigma - 0.5f) / 0.57735f), BlurMaskFilter.Blur.NORMAL)
    drawing.drawPath(traced, blurring)
    return image
  }
}
