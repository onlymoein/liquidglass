import ExpoModulesCore

// The controls are UIKit's own, so on iOS 26 and later they're drawn in Liquid Glass by iOS itself.
// Each view reports the size UIKit wants it to be, and the JavaScript side gives it that size.
public class LiquidGlassModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiquidGlass")

    View(SwitchView.self) {
      Events("onSize", "onValueChange")
      Prop("checked") { (view: SwitchView, checked: Bool) in view.setChecked(checked) }
      Prop("disabled") { (view: SwitchView, disabled: Bool?) in view.control.isEnabled = !(disabled ?? false) }
      Prop("tint") { (view: SwitchView, tint: UIColor?) in view.control.onTintColor = tint }
      Prop("resync") { (view: SwitchView, _: Int?) in view.resync() }
    }

    View(SliderView.self) {
      Events("onSize", "onValueChange", "onSlidingComplete")
      Prop("value") { (view: SliderView, value: Double) in view.setValue(value) }
      Prop("min") { (view: SliderView, min: Double?) in view.setRange(min: min ?? 0, max: nil) }
      Prop("max") { (view: SliderView, max: Double?) in view.setRange(min: nil, max: max ?? 1) }
      Prop("step") { (view: SliderView, step: Double?) in view.step = step ?? 0 }
      Prop("disabled") { (view: SliderView, disabled: Bool?) in view.control.isEnabled = !(disabled ?? false) }
      Prop("tint") { (view: SliderView, tint: UIColor?) in view.control.minimumTrackTintColor = tint }
      Prop("resync") { (view: SliderView, _: Int?) in view.resync() }
    }

    View(StepperView.self) {
      Events("onSize", "onValueChange")
      Prop("value") { (view: StepperView, value: Double) in view.setValue(value) }
      Prop("min") { (view: StepperView, min: Double?) in view.control.minimumValue = min ?? 0 }
      Prop("max") { (view: StepperView, max: Double?) in view.control.maximumValue = max ?? 100 }
      Prop("step") { (view: StepperView, step: Double?) in view.control.stepValue = Swift.max(step ?? 1, .ulpOfOne) }
      Prop("disabled") { (view: StepperView, disabled: Bool?) in view.control.isEnabled = !(disabled ?? false) }
      Prop("resync") { (view: StepperView, _: Int?) in view.resync() }
    }

    View(SegmentedControlView.self) {
      Events("onSize", "onValueChange")
      Prop("items") { (view: SegmentedControlView, items: [SegmentItem]) in view.setItems(items) }
      Prop("selected") { (view: SegmentedControlView, selected: String?) in view.setSelected(selected) }
      Prop("disabled") { (view: SegmentedControlView, disabled: Bool?) in view.control.isEnabled = !(disabled ?? false) }
      Prop("fontFamily") { (view: SegmentedControlView, family: String?) in view.fontFamily = family }
      Prop("resync") { (view: SegmentedControlView, _: Int?) in view.resync() }
    }

    View(TabBarView.self) {
      Events("onSize", "onValueChange", "onTabLayout")
      Prop("items") { (view: TabBarView, items: [TabItem]) in view.setItems(items) }
      Prop("selected") { (view: TabBarView, selected: String?) in view.setSelected(selected) }
      Prop("tint") { (view: TabBarView, tint: UIColor?) in view.bar.tintColor = tint }
      Prop("fontFamily") { (view: TabBarView, family: String?) in view.fontFamily = family }
      Prop("resync") { (view: TabBarView, _: Int?) in view.resync() }
    }

    View(ButtonView.self) {
      Events("onSize", "onTrigger", "onMenuSelect")
      Prop("label") { (view: ButtonView, label: String?) in view.label = label; view.update() }
      Prop("icon") { (view: ButtonView, icon: String?) in view.icon = icon; view.update() }
      Prop("iconUri") { (view: ButtonView, uri: String?) in view.iconUri = uri; view.update() }
      Prop("fontFamily") { (view: ButtonView, family: String?) in view.fontFamily = family; view.update() }
      Prop("variant") { (view: ButtonView, variant: String?) in view.filled = variant == "filled"; view.update() }
      Prop("size") { (view: ButtonView, size: String?) in view.size = size ?? "regular"; view.update() }
      Prop("tint") { (view: ButtonView, tint: UIColor?) in view.tint = tint; view.update() }
      Prop("destructive") { (view: ButtonView, destructive: Bool?) in view.destructive = destructive ?? false; view.update() }
      Prop("disabled") { (view: ButtonView, disabled: Bool?) in view.button.isEnabled = !(disabled ?? false) }
      Prop("menu") { (view: ButtonView, menu: [MenuEntry]?) in view.setMenu(menu) }
    }
  }
}

struct SegmentItem: Record {
  @Field var value: String = ""
  @Field var label: String = ""
  @Field var icon: String?
  @Field var disabled: Bool = false
}

struct TabItem: Record {
  @Field var value: String = ""
  @Field var label: String = ""
  @Field var icon: String?
  @Field var selectedIcon: String?
  /// The app's own image instead of a symbol.
  @Field var iconUri: String?
  @Field var selectedIconUri: String?
  @Field var badge: String?
  @Field var testID: String?
  @Field var accessibilityLabel: String?
}

struct MenuEntry: Record {
  @Field var value: String = ""
  @Field var label: String = ""
  @Field var icon: String?
  @Field var destructive: Bool = false
  @Field var disabled: Bool = false
  @Field var checked: Bool = false
}
