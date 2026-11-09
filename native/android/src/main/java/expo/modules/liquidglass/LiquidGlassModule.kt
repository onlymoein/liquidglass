package expo.modules.liquidglass

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android has no Liquid Glass of its own. The glass views are still to come; until then the
// JavaScript side draws plain stand-ins.
class LiquidGlassModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LiquidGlass")
  }
}
