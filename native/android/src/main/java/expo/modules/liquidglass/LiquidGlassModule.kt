package expo.modules.liquidglass

import android.graphics.Color
import android.graphics.RectF
import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.WindowInsets
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android has no Liquid Glass of its own, so the glass here is drawn by the package: a
// backdrop records what's behind, and glass draws it again through a shader.
class LiquidGlassModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LiquidGlass")

    /**
     * A tick under the finger, as iOS's controls give: Android's own haptic effects, which follow
     * the phone's touch feedback setting.
     */
    Function("haptic") { kind: String ->
      val view = appContext.currentActivity?.window?.decorView ?: return@Function
      val effect = when (kind) {
        "on" -> if (Build.VERSION.SDK_INT >= 34) HapticFeedbackConstants.TOGGLE_ON else HapticFeedbackConstants.CLOCK_TICK
        "off" -> if (Build.VERSION.SDK_INT >= 34) HapticFeedbackConstants.TOGGLE_OFF else HapticFeedbackConstants.CLOCK_TICK
        "select" -> if (Build.VERSION.SDK_INT >= 34) HapticFeedbackConstants.SEGMENT_TICK else HapticFeedbackConstants.CLOCK_TICK
        else -> HapticFeedbackConstants.CLOCK_TICK
      }
      view.post { view.performHapticFeedback(effect) }
    }

    /** Whether the package draws an icon by this SF Symbols name. */
    Function("hasIcon") { name: String -> IconView.has(name) }

    /**
     * How tall the system's navigation bar or gesture handle is, in points, so a bar at the foot
     * of the screen can sit above it as iOS's tab bar sits above the home indicator.
     */
    Function("bottomInset") {
      val view = appContext.currentActivity?.window?.decorView ?: return@Function 0.0
      val insets = view.rootWindowInsets ?: return@Function 0.0
      val bottom = if (Build.VERSION.SDK_INT >= 30) {
        insets.getInsets(WindowInsets.Type.navigationBars()).bottom
      } else {
        @Suppress("DEPRECATION")
        insets.systemWindowInsetBottom
      }
      (bottom / view.resources.displayMetrics.density).toDouble()
    }

    // The rim light follows the phone only while the app is in front.
    OnActivityEntersForeground { Tilt.resume() }
    OnActivityEntersBackground { Tilt.pause() }

    View(BackdropView::class) {}

    View(GlassGroupView::class) {
      Prop("spacing") { view: GlassGroupView, spacing: Float? -> view.spacing = spacing ?: 20f }
    }

    View(BounceView::class) {}

    View(TrackView::class) {
      Events("onTrackStart", "onTrackClaim", "onTrack", "onTrackEnd")
      Prop("enabled") { view: TrackView, enabled: Boolean? -> view.follows = enabled ?: true }
      Prop("patient") { view: TrackView, patient: Boolean? -> view.patient = patient ?: false }
    }

    View(GlassView::class) {
      Events("onBackdropMissing", "onFolded")
      Prop("cornerRadius") { view: GlassView, radius: Float? -> view.cornerRadius = radius ?: 0f }
      Prop("clear") { view: GlassView, clear: Boolean? -> view.clear = clear ?: false }
      Prop("dark") { view: GlassView, dark: Boolean? -> view.dark = dark ?: false }
      Prop("tint") { view: GlassView, tint: Color? -> view.tint = tint?.toArgb() }
      Prop("lens") { view: GlassView, lens: Boolean? -> view.lens = lens ?: false }
      Prop("prominent") { view: GlassView, prominent: Boolean? -> view.prominent = prominent ?: false }
      Prop("held") { view: GlassView, held: Boolean? -> view.held = held ?: false }
      Prop("touch") { view: GlassView, touch: List<Float>? ->
        view.touch = if (touch != null && touch.size == 2) touch[0] to touch[1] else null
      }
      Prop("zoom") { view: GlassView, zoom: Float? -> view.zoom = zoom ?: 1f }
      Prop("split") { view: GlassView, split: Float? -> view.split = split ?: 0f }
      Prop("outermost") { view: GlassView, outermost: Boolean? -> view.outermost = outermost ?: false }
      Prop("growFrom") { view: GlassView, from: List<Float>? ->
        view.growFrom = if (from != null && from.size == 4) RectF(from[0], from[1], from[0] + from[2], from[1] + from[3]) else null
      }
      Prop("open") { view: GlassView, open: Boolean? -> view.open = open ?: true }
      Prop("still") { view: GlassView, still: Boolean? -> view.still = still ?: false }
    }

    View(IconView::class) {
      Prop("name") { view: IconView, name: String? -> view.name = name ?: "" }
      Prop("color") { view: IconView, color: Color? -> view.colour = color?.toArgb() ?: Color.BLACK }
      Prop("weight") { view: IconView, weight: Float? -> view.weight = weight ?: 1f }
    }
  }
}
