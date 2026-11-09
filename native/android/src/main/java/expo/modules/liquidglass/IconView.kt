package expo.modules.liquidglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * The package's own icons, for where Apple's SF Symbols can't go. They're drawn here, line by
 * line on a 24-point grid, in the spirit of SF Symbols' regular weight: round ends, even strokes.
 * Each answers to the SF Symbols name an app already passes for iOS, and `.fill` gives the solid
 * version where there is one.
 */
class IconView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  var name = ""
    set(value) { field = value; invalidate() }
  var colour = Color.BLACK
    set(value) { field = value; invalidate() }

  private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
  }
  private val solid = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val path = Path()

  init {
    setWillNotDraw(false)
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val scale = min(width, height) / 24f
    if (scale <= 0f) return
    canvas.save()
    canvas.translate((width - 24f * scale) / 2f, (height - 24f * scale) / 2f)
    canvas.scale(scale, scale)
    line.color = colour
    line.strokeWidth = 1.5f
    solid.color = colour
    val filled = name.endsWith(".fill")
    draw(canvas, name.removeSuffix(".fill"), filled)
    canvas.restore()
  }

  private fun stroke(canvas: Canvas, width: Float = 1.5f, build: Path.() -> Unit) {
    path.reset()
    path.build()
    line.strokeWidth = width
    canvas.drawPath(path, line)
  }

  private fun shape(canvas: Canvas, filled: Boolean, build: Path.() -> Unit) {
    path.reset()
    path.build()
    if (filled) {
      canvas.drawPath(path, solid)
      line.strokeWidth = 1.5f
      canvas.drawPath(path, line)
    } else {
      line.strokeWidth = 1.5f
      canvas.drawPath(path, line)
    }
  }

  private fun circle(canvas: Canvas, x: Float, y: Float, r: Float, filled: Boolean = false) {
    line.strokeWidth = 1.5f
    canvas.drawCircle(x, y, r, if (filled) solid else line)
  }

  private fun draw(canvas: Canvas, icon: String, filled: Boolean) {
    when (icon) {
      "house" -> {
        shape(canvas, filled) {
          moveTo(5.5f, 9.8f); lineTo(12f, 4.4f); lineTo(18.5f, 9.8f); lineTo(18.5f, 19.5f)
          lineTo(14f, 19.5f); lineTo(14f, 14.5f); lineTo(10f, 14.5f); lineTo(10f, 19.5f)
          lineTo(5.5f, 19.5f); close()
        }
        stroke(canvas) { moveTo(3.5f, 11.3f); lineTo(12f, 4f); lineTo(20.5f, 11.3f) }
      }

      "magnifyingglass" -> {
        circle(canvas, 10.5f, 10.5f, 6.25f)
        stroke(canvas, 2.2f) { moveTo(15.3f, 15.3f); lineTo(20.3f, 20.3f) }
      }

      "gear", "gearshape" -> {
        for (k in 0 until 8) {
          val a = Math.toRadians(k * 45.0 + 22.5)
          stroke(canvas, 2.5f) {
            moveTo(12f + 7.2f * cos(a).toFloat(), 12f + 7.2f * sin(a).toFloat())
            lineTo(12f + 8.6f * cos(a).toFloat(), 12f + 8.6f * sin(a).toFloat())
          }
        }
        if (filled) {
          path.reset()
          path.fillType = Path.FillType.EVEN_ODD
          path.addCircle(12f, 12f, 7.4f, Path.Direction.CW)
          path.addCircle(12f, 12f, 2.6f, Path.Direction.CW)
          canvas.drawPath(path, solid)
          path.fillType = Path.FillType.WINDING
        } else {
          circle(canvas, 12f, 12f, 6.6f)
          circle(canvas, 12f, 12f, 2.6f)
        }
      }

      "bookmark" -> shape(canvas, filled) {
        moveTo(6.5f, 3.5f); lineTo(17.5f, 3.5f); lineTo(17.5f, 20.5f); lineTo(12f, 16.3f)
        lineTo(6.5f, 20.5f); close()
      }

      "slider.horizontal.3" -> {
        for ((y, x) in listOf(6f to 15f, 12f to 8f, 18f to 13f)) {
          stroke(canvas) { moveTo(3.5f, y); lineTo(x - 2.3f, y); moveTo(x + 2.3f, y); lineTo(20.5f, y) }
          circle(canvas, x, y, 2.3f, filled)
        }
      }

      "circle.hexagongrid" -> {
        circle(canvas, 12f, 12f, 2.4f, filled)
        for (k in 0 until 6) {
          val a = Math.toRadians(k * 60.0)
          circle(canvas, 12f + 5.6f * cos(a).toFloat(), 12f + 5.6f * sin(a).toFloat(), 2.4f, filled)
        }
      }

      "chevron.backward", "chevron.left" -> stroke(canvas, 2.2f) { moveTo(15f, 4.5f); lineTo(7.5f, 12f); lineTo(15f, 19.5f) }
      "chevron.forward", "chevron.right" -> stroke(canvas, 2.2f) { moveTo(9f, 4.5f); lineTo(16.5f, 12f); lineTo(9f, 19.5f) }
      "chevron.down" -> stroke(canvas, 2.2f) { moveTo(4.5f, 9f); lineTo(12f, 16.5f); lineTo(19.5f, 9f) }
      "chevron.up" -> stroke(canvas, 2.2f) { moveTo(4.5f, 15f); lineTo(12f, 7.5f); lineTo(19.5f, 15f) }

      "trash" -> {
        stroke(canvas) { moveTo(3.5f, 6.5f); lineTo(20.5f, 6.5f); moveTo(9f, 6.5f); lineTo(9f, 4f); lineTo(15f, 4f); lineTo(15f, 6.5f) }
        shape(canvas, filled) { moveTo(6f, 6.5f); lineTo(7f, 20f); lineTo(17f, 20f); lineTo(18f, 6.5f) }
        if (!filled) stroke(canvas) { moveTo(10f, 10f); lineTo(10.2f, 16.5f); moveTo(14f, 10f); lineTo(13.8f, 16.5f) }
      }

      "arrow.up.arrow.down" -> stroke(canvas) {
        moveTo(8f, 19.5f); lineTo(8f, 4.5f); moveTo(4.5f, 8f); lineTo(8f, 4.5f); lineTo(11.5f, 8f)
        moveTo(16f, 4.5f); lineTo(16f, 19.5f); moveTo(12.5f, 16f); lineTo(16f, 19.5f); lineTo(19.5f, 16f)
      }

      "plus" -> stroke(canvas, 2f) { moveTo(12f, 4.5f); lineTo(12f, 19.5f); moveTo(4.5f, 12f); lineTo(19.5f, 12f) }
      "minus" -> stroke(canvas, 2f) { moveTo(4.5f, 12f); lineTo(19.5f, 12f) }
      "xmark" -> stroke(canvas, 2f) { moveTo(6f, 6f); lineTo(18f, 18f); moveTo(18f, 6f); lineTo(6f, 18f) }
      "checkmark" -> stroke(canvas, 2.2f) { moveTo(4.5f, 12.5f); lineTo(9.5f, 17.5f); lineTo(19.5f, 6.5f) }

      "heart" -> shape(canvas, filled) {
        moveTo(12f, 20f)
        cubicTo(5f, 15.3f, 2.8f, 11.8f, 2.8f, 8.7f)
        cubicTo(2.8f, 6f, 4.9f, 4f, 7.4f, 4f)
        cubicTo(9.3f, 4f, 11f, 5.1f, 12f, 6.8f)
        cubicTo(13f, 5.1f, 14.7f, 4f, 16.6f, 4f)
        cubicTo(19.1f, 4f, 21.2f, 6f, 21.2f, 8.7f)
        cubicTo(21.2f, 11.8f, 19f, 15.3f, 12f, 20f)
        close()
      }

      "star" -> shape(canvas, filled) {
        for (k in 0 until 10) {
          val a = Math.toRadians(-90.0 + k * 36.0)
          val r = if (k % 2 == 0) 9f else 3.9f
          val x = 12f + r * cos(a).toFloat()
          val y = 12.6f + r * sin(a).toFloat()
          if (k == 0) moveTo(x, y) else lineTo(x, y)
        }
        close()
      }

      "person" -> {
        circle(canvas, 12f, 8f, 3.8f, filled)
        shape(canvas, filled) {
          moveTo(4.5f, 20.5f); cubicTo(4.5f, 16.6f, 7.8f, 14f, 12f, 14f); cubicTo(16.2f, 14f, 19.5f, 16.6f, 19.5f, 20.5f)
          if (filled) close()
        }
      }

      "bell" -> {
        shape(canvas, filled) {
          moveTo(6f, 16.5f); lineTo(6f, 10.8f); cubicTo(6f, 7.2f, 8.6f, 4.5f, 12f, 4.5f)
          cubicTo(15.4f, 4.5f, 18f, 7.2f, 18f, 10.8f); lineTo(18f, 16.5f); lineTo(19.5f, 18f)
          lineTo(4.5f, 18f); close()
        }
        stroke(canvas) { moveTo(10f, 20.5f); lineTo(14f, 20.5f) }
      }

      "ellipsis" -> for (x in listOf(5.5f, 12f, 18.5f)) circle(canvas, x, 12f, 1.6f, true)

      "square.and.arrow.up" -> stroke(canvas) {
        moveTo(8.5f, 9.5f); lineTo(6.5f, 9.5f); lineTo(6.5f, 20f); lineTo(17.5f, 20f); lineTo(17.5f, 9.5f); lineTo(15.5f, 9.5f)
        moveTo(12f, 15f); lineTo(12f, 3.5f); moveTo(8.5f, 7f); lineTo(12f, 3.5f); lineTo(15.5f, 7f)
      }

      "calendar" -> {
        line.strokeWidth = 1.5f
        canvas.drawRoundRect(RectF(4f, 5.5f, 20f, 20f), 2.5f, 2.5f, line)
        stroke(canvas) { moveTo(4f, 9.8f); lineTo(20f, 9.8f); moveTo(8f, 3.5f); lineTo(8f, 6.5f); moveTo(16f, 3.5f); lineTo(16f, 6.5f) }
      }

      "textformat" -> {
        stroke(canvas) { moveTo(2.5f, 18f); lineTo(7f, 6f); lineTo(11.5f, 18f); moveTo(4.2f, 13.5f); lineTo(9.8f, 13.5f) }
        circle(canvas, 17f, 14.5f, 3.5f)
        stroke(canvas) { moveTo(20.5f, 11f); lineTo(20.5f, 18f) }
      }

      "internaldrive" -> {
        line.strokeWidth = 1.5f
        canvas.drawRoundRect(RectF(3f, 7f, 21f, 17f), 2.5f, 2.5f, line)
        circle(canvas, 17f, 12f, 1.1f, true)
      }

      else -> Unit
    }
  }

  companion object {
    /** Whether there's an icon by this name, so a control can leave room for it or not. */
    fun has(name: String): Boolean = name.removeSuffix(".fill") in NAMES

    private val NAMES = setOf(
      "house", "magnifyingglass", "gear", "gearshape", "bookmark", "slider.horizontal.3", "circle.hexagongrid",
      "chevron.backward", "chevron.left", "chevron.forward", "chevron.right", "chevron.down", "chevron.up",
      "trash", "arrow.up.arrow.down", "plus", "minus", "xmark", "checkmark", "heart", "star", "person", "bell",
      "ellipsis", "square.and.arrow.up", "calendar", "textformat", "internaldrive",
    )
  }
}
