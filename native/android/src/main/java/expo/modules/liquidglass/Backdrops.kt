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
   * The `outermost` is the furthest out of those, the one that holds the others.
   */
  fun behind(view: View, outermost: Boolean = false): BackdropView? {
    view.getLocationInWindow(here)
    val x = here[0] + view.width / 2
    val y = here[1] + view.height / 2
    var found: BackdropView? = null
    var child: View = view
    var parent = child.parent
    while (parent is ViewGroup) {
      val index = parent.indexOfChild(child)
      for (i in index - 1 downTo 0) {
        val backdrop = search(parent.getChildAt(i), x, y) ?: continue
        if (!outermost) return backdrop
        found = backdrop
        break
      }
      child = parent
      parent = parent.parent
    }
    return found
  }

  // Glass drawn earlier can hold a backdrop of its own, as the tab bar holds its tabs for its lens.
  // A backdrop that covers the glass is taken before any inside it: it draws them too, and all
  // else that's in it. A page's background, put in a backdrop of its own for the page's glass,
  // is then not all the tab bar over the page shows.
  private fun search(view: View, x: Int, y: Int): BackdropView? {
    if (view.visibility != View.VISIBLE || view !is ViewGroup) return null
    if (covers(view, x, y)) return view as BackdropView
    for (i in view.childCount - 1 downTo 0) search(view.getChildAt(i), x, y)?.let { return it }
    return null
  }

  private fun covers(view: View, x: Int, y: Int): Boolean {
    if (view !is BackdropView || view.width <= 0 || view.height <= 0) return false
    view.getLocationInWindow(there)
    return x >= there[0] && x <= there[0] + view.width && y >= there[1] && y <= there[1] + view.height
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
