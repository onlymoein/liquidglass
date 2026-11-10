package expo.modules.liquidglass

import android.graphics.Color
import android.os.Build
import android.view.WindowInsets
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android has no Liquid Glass of its own, so the glass here is drawn by the package: a
// backdrop records what's behind, and glass draws it again through a shader.
class LiquidGlassModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LiquidGlass")

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

    View(GlassView::class) {
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
    }

    View(IconView::class) {
      Prop("name") { view: IconView, name: String? -> view.name = name ?: "" }
      Prop("color") { view: IconView, color: Color? -> view.colour = color?.toArgb() ?: Color.BLACK }
      Prop("weight") { view: IconView, weight: Float? -> view.weight = weight ?: 1f }
    }
  }
}
