package expo.modules.liquidglass

import android.graphics.Matrix
import android.view.View
import android.view.ViewGroup

/** Finding the backdrop behind a piece of glass, and where it lies relative to that glass. */
internal object Backdrops {
  private val here = IntArray(2)
  private val there = IntArray(2)
  private val toScreen = Matrix()
  private val backdropToScreen = Matrix()

  /**
   * The backdrop behind this view: the nearest one drawn before it, as a sibling of the view or
   * of one of its ancestors or inside one, that covers the view's middle. A switch's thumb finds
   * its track that way, and the card the switch sits on passes over that track for the page.
   */
  fun behind(view: View): BackdropView? {
    view.getLocationInWindow(here)
    val x = here[0] + view.width / 2
    val y = here[1] + view.height / 2
    var child: View = view
    var parent = child.parent
    while (parent is ViewGroup) {
      val index = parent.indexOfChild(child)
      for (i in index - 1 downTo 0) {
        search(parent.getChildAt(i), x, y)?.let { return it }
      }
      child = parent
      parent = parent.parent
    }
    return null
  }

  // Glass drawn earlier can hold a backdrop of its own, as the tab bar holds its tabs for its lens.
  private fun search(view: View, x: Int, y: Int): BackdropView? {
    if (view.visibility != View.VISIBLE || view !is ViewGroup) return null
    for (i in view.childCount - 1 downTo 0) search(view.getChildAt(i), x, y)?.let { return it }
    if (view is BackdropView && view.width > 0 && view.height > 0) {
      view.getLocationInWindow(there)
      if (x >= there[0] && x <= there[0] + view.width && y >= there[1] && y <= there[1] + view.height) return view
    }
    return null
  }

  /**
   * Sets `out` to take the backdrop's points to the view's own, every transform on the way
   * included, so glass that moves or grows over its backdrop still lines up. False if the view
   * has no size to map to.
   */
  fun mapping(backdrop: View, view: View, out: Matrix): Boolean {
    toScreen.reset()
    view.transformMatrixToGlobal(toScreen)
    backdropToScreen.reset()
    backdrop.transformMatrixToGlobal(backdropToScreen)
    if (!toScreen.invert(out)) return false
    out.preConcat(backdropToScreen)
    return true
  }
}
