package expo.modules.liquidglass

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Glass without the shader, before Android 13: what's behind it blurred and toned as the shader
 * tones it, and its rim lit along the ends that face the light, with the hairline just outside.
 * It doesn't bend, but it reads as the same glass.
 */
internal object Plain {
  /** The shader's tone, `(rgb - 0.5) * contrast + 0.5`, then brightness, then saturation, as a colour matrix. */
  fun tone(out: ColorMatrix, contrast: Float, brightness: Float, saturation: Float) {
    val scale = contrast * brightness
    val shift = 127.5f * (1f - contrast) * brightness
    out.set(
      floatArrayOf(
        scale, 0f, 0f, 0f, shift,
        0f, scale, 0f, 0f, shift,
        0f, 0f, scale, 0f, shift,
        0f, 0f, 0f, 1f, 0f,
      )
    )
    if (saturation != 1f) out.postConcat(ColorMatrix().apply { setSaturation(saturation) })
  }

  /** A filled button: its colour, darkened a little by what's behind, as the shader draws it. */
  fun prominent(out: ColorMatrix, tint: Int) {
    val r = Color.red(tint) / 255f
    val g = Color.green(tint) / 255f
    val b = Color.blue(tint) / 255f
    fun row(c: Float) = floatArrayOf(0.2f * c * 0.2126f, 0.2f * c * 0.7152f, 0.2f * c * 0.0722f, 0f, 0.8f * c * 255f)
    out.set(row(r) + row(g) + row(b) + floatArrayOf(0f, 0f, 0f, 1f, 0f))
  }

  private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val glow = Paint(Paint.ANTI_ALIAS_FLAG)

  /**
   * The rim, over the glass. The shader lights the edge where it faces the light or faces away
   * from it, strongest right at the edge and gone a point and a half in, and draws a faint dark
   * hairline just outside it.
   */
  fun rim(canvas: Canvas, shape: Path, width: Float, height: Float, density: Float, lightX: Float, lightY: Float, shine: Float, clear: Boolean) {
    if (shine <= 0f) return
    val save = canvas.save()
    canvas.clipOutPath(shape)
    line.shader = null
    line.strokeWidth = 1.5f * density
    line.color = Color.argb((0.14f * shine * 255f).roundToInt(), 0, 0, 0)
    canvas.drawPath(shape, line)
    canvas.restoreToCount(save)

    canvas.save()
    canvas.clipPath(shape)
    // Lit at both ends along the light, unlit at the sides across it.
    val cx = width / 2f
    val cy = height / 2f
    val reachAlong = (kotlin.math.abs(lightX) * width + kotlin.math.abs(lightY) * height) / 2f
    val lit = ((if (clear) 0.62f else 0.36f) * shine).coerceAtMost(1f)
    val far = lit * 0.7f
    fun white(a: Float) = Color.argb((a * 255f).roundToInt().coerceIn(0, 255), 255, 255, 255)
    line.shader = LinearGradient(
      cx + lightX * reachAlong, cy + lightY * reachAlong, cx - lightX * reachAlong, cy - lightY * reachAlong,
      intArrayOf(white(lit), white(0f), white(0f), white(far)),
      floatArrayOf(0f, 0.38f, 0.62f, 1f),
      Shader.TileMode.CLAMP,
    )
    line.strokeWidth = 2.2f * density
    canvas.drawPath(shape, line)
    line.shader = null
    canvas.restoreToCount(save)
  }

  /** Under a finger, a faint light where it's touching, as a wide soft circle. */
  fun glow(canvas: Canvas, shape: Path, x: Float, y: Float, density: Float) {
    val radius = 240f * density
    glow.shader = RadialGradient(
      x, y, radius,
      intArrayOf(Color.argb(9, 255, 255, 255), Color.argb(6, 255, 255, 255), Color.argb(0, 255, 255, 255)),
      floatArrayOf(0f, 0.5f, 1f),
      Shader.TileMode.CLAMP,
    )
    canvas.drawPath(shape, glow)
    glow.shader = null
  }

  private var pixels = IntArray(0)
  private var planes = Array(4) { IntArray(0) }
  private var spare = IntArray(0)

  /**
   * Blurs a picture in place, by about a Gaussian of deviation `sigma` pixels: three box blurs,
   * across and down, on its colours weighted by how opaque they are, so clear parts don't darken
   * what's next to them.
   */
  fun blur(bitmap: Bitmap, sigma: Float) {
    if (sigma < 0.5f) return
    val w = bitmap.width
    val h = bitmap.height
    val n = w * h
    if (n == 0) return
    if (pixels.size < n) {
      pixels = IntArray(n)
      planes = Array(4) { IntArray(n) }
      spare = IntArray(n)
    }
    bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
    val (a, r, g, b) = planes
    for (i in 0 until n) {
      val c = pixels[i]
      val alpha = c ushr 24
      a[i] = alpha
      r[i] = (c shr 16 and 0xff) * alpha / 255
      g[i] = (c shr 8 and 0xff) * alpha / 255
      b[i] = (c and 0xff) * alpha / 255
    }
    // Three boxes of width 2r + 1 spread as a Gaussian of deviation sigma when (2r + 1)² = 4σ² + 1.
    val radius = max(1, ((sqrt(4f * sigma * sigma + 1f) - 1f) / 2f).roundToInt())
    for (plane in planes) {
      repeat(3) {
        box(plane, spare, w, h, radius, across = true)
        box(spare, plane, w, h, radius, across = false)
      }
    }
    for (i in 0 until n) {
      val alpha = a[i].coerceIn(0, 255)
      pixels[i] = if (alpha == 0) 0 else (alpha shl 24) or
        ((r[i] * 255 / alpha).coerceIn(0, 255) shl 16) or
        ((g[i] * 255 / alpha).coerceIn(0, 255) shl 8) or
        (b[i] * 255 / alpha).coerceIn(0, 255)
    }
    bitmap.setPixels(pixels, 0, w, 0, 0, w, h)
  }

  // A running sum along each row, or each column, with the edge pixels standing in past the edge.
  private fun box(from: IntArray, to: IntArray, w: Int, h: Int, r: Int, across: Boolean) {
    val lines = if (across) h else w
    val length = if (across) w else h
    val step = if (across) 1 else w
    val width = 2 * r + 1
    val last = length - 1
    // Dividing by the width as a multiply and a shift.
    val scale = (1 shl 16) / width
    for (l in 0 until lines) {
      val start = if (across) l * w else l
      val first = from[start]
      val end = from[start + last * step]
      var sum = 0
      for (k in -r..r) sum += from[start + min(last, max(0, k)) * step]
      var at = start
      for (k in 0 until length) {
        to[at] = (sum * scale) ushr 16
        val add = k + r + 1
        val drop = k - r
        sum += (if (add <= last) from[start + add * step] else end) - (if (drop >= 0) from[start + drop * step] else first)
        at += step
      }
    }
  }
}
