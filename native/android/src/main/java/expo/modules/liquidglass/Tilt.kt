package expo.modules.liquidglass

import android.animation.ValueAnimator
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.view.Surface
import android.view.View
import java.util.Collections
import java.util.WeakHashMap
import kotlin.math.abs
import kotlin.math.hypot

/** Glass whose rim light follows the phone. */
internal interface Lit {
  fun lightMoved()
}

/**
 * Where the light on the glass comes from. Upright, it's straight above, so the rim is lit along
 * the top and bottom. Turn the phone and the light stays where it is in the room, so it slides
 * round the rim toward the corners. Lying flat, the phone has no up, and the light settles back
 * to the top.
 *
 * It listens to gravity only while glass is on screen and the app is in front, and not at all
 * when the system's animations are off.
 */
internal object Tilt : SensorEventListener {
  /** The light's direction on the screen, as a unit vector: (0, -1) is straight up. */
  var x = 0f
    private set
  var y = -1f
    private set
  /** Goes up each time the light moves enough to redraw for. */
  var version = 0
    private set

  private val glass: MutableSet<Lit> = Collections.newSetFromMap(WeakHashMap())
  private var manager: SensorManager? = null
  private var listening = false
  private var paused = false
  private var screen: View? = null
  private var smoothX = 0f
  private var smoothY = -1f

  fun watch(view: View, lit: Lit) {
    glass.add(lit)
    screen = view.rootView
    if (manager == null) manager = view.context.applicationContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    update()
  }

  fun unwatch(lit: Lit) {
    glass.remove(lit)
    update()
  }

  fun pause() {
    paused = true
    update()
  }

  fun resume() {
    paused = false
    update()
  }

  private fun update() {
    val want = glass.isNotEmpty() && !paused && ValueAnimator.areAnimatorsEnabled()
    val sensors = manager ?: return
    if (want && !listening) {
      val sensor = sensors.getDefaultSensor(Sensor.TYPE_GRAVITY) ?: sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return
      listening = sensors.registerListener(this, sensor, SensorManager.SENSOR_DELAY_UI)
    } else if (!want && listening) {
      sensors.unregisterListener(this)
      listening = false
      if (x != 0f || y != -1f) settle(0f, -1f)
    }
  }

  override fun onSensorChanged(event: SensorEvent) {
    val ax = event.values[0]
    val ay = event.values[1]
    // The sensor reads in the phone's own axes. Turn them to the screen's, as it's showing now.
    val (sx, sy) = when (screen?.display?.rotation ?: Surface.ROTATION_0) {
      Surface.ROTATION_90 -> -ay to ax
      Surface.ROTATION_180 -> -ax to -ay
      Surface.ROTATION_270 -> ay to -ax
      else -> ax to ay
    }
    // Up in the room, seen on the screen, whose y runs down. How much of it there is says how
    // upright the phone is: none when it lies flat.
    val upright = hypot(sx, sy)
    val weight = ((upright - 1.5f) / 3f).coerceIn(0f, 1f)
    var tx = if (upright > 0f) sx / upright * weight else 0f
    var ty = if (upright > 0f) -sy / upright * weight - (1f - weight) else -1f
    val length = hypot(tx, ty)
    if (length < 0.001f) {
      tx = 0f
      ty = -1f
    } else {
      tx /= length
      ty /= length
    }
    smoothX += (tx - smoothX) * 0.3f
    smoothY += (ty - smoothY) * 0.3f
    val size = hypot(smoothX, smoothY)
    if (size < 0.001f) return
    settle(smoothX / size, smoothY / size)
  }

  private fun settle(nx: Float, ny: Float) {
    // Half a degree is too little to see.
    if (abs(nx - x) < 0.009f && abs(ny - y) < 0.009f) return
    x = nx
    y = ny
    version++
    for (lit in glass.toList()) lit.lightMoved()
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
