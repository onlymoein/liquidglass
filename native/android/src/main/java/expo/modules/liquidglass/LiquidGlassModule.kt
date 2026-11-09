package expo.modules.liquidglass

import android.graphics.Color
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android has no Liquid Glass of its own, so the glass here is drawn by the package: a
// backdrop records what's behind, and glass draws it again through a shader.
class LiquidGlassModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LiquidGlass")

    View(BackdropView::class) {}

    View(GlassView::class) {
      Prop("cornerRadius") { view: GlassView, radius: Float? -> view.cornerRadius = radius ?: 0f }
      Prop("clear") { view: GlassView, clear: Boolean? -> view.clear = clear ?: false }
      Prop("dark") { view: GlassView, dark: Boolean? -> view.dark = dark ?: false }
      Prop("tint") { view: GlassView, tint: Color? -> view.tint = tint?.toArgb() }
    }
  }
}
