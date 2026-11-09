import ExpoModulesCore

/// Hosts one UIKit control and tells JavaScript what size UIKit wants it, so React Native lays it out
/// at that size. A control that fills its width, as a slider does, only has its height taken.
class ControlView: ExpoView {
  var hosted: UIView { fatalError("A control view has to say which view it hosts.") }

  /// Expo finds a view's events among its own properties, not its superclass's, so each kind of
  /// control declares its own `onSize` and hands it over here.
  var sizeEvent: EventDispatcher { fatalError("A control view has to declare its own onSize.") }

  /// Whether the control sits at its own size in the middle of the box, rather than filling it.
  var centred: Bool { false }

  func attach() {
    clipsToBounds = false
    addSubview(hosted)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if centred {
      let size = hosted.sizeThatFits(UIView.layoutFittingCompressedSize)
      hosted.frame = CGRect(
        x: (bounds.width - size.width) / 2,
        y: (bounds.height - size.height) / 2,
        width: size.width,
        height: size.height
      )
    } else {
      hosted.frame = bounds
    }
    report()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    report()
  }

  /// Tells JavaScript the size UIKit wants, until React Native gives the box that size. A report
  /// sent while the view is still being mounted can arrive before anything listens, so one isn't
  /// taken as delivered until the box has changed to match.
  func report() {
    let width = bounds.width > 0 && !centred ? bounds.width : CGFloat.greatestFiniteMagnitude
    var size = hosted.sizeThatFits(CGSize(width: width, height: CGFloat.greatestFiniteMagnitude))
    if !size.width.isFinite || size.width >= CGFloat.greatestFiniteMagnitude / 2 { size.width = 0 }
    size.width = ceil(size.width)
    size.height = ceil(size.height)
    guard size.height > 0 else { return }
    let fits = abs(bounds.height - size.height) < 0.5 && (!centred || abs(bounds.width - size.width) < 0.5)
    guard !fits else { return }
    sizeEvent(["width": size.width, "height": size.height])
    guard !retrying else { return }
    retrying = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
      self?.retrying = false
      self?.report()
    }
  }

  private var retrying = false
}

final class SwitchView: ControlView {
  let onSize = EventDispatcher()
  override var sizeEvent: EventDispatcher { onSize }
  let control = UISwitch()
  let onValueChange = EventDispatcher()
  override var hosted: UIView { control }
  override var centred: Bool { true }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    attach()
    control.addTarget(self, action: #selector(changed), for: .valueChanged)
  }

  func setChecked(_ checked: Bool) {
    if control.isOn != checked { control.setOn(checked, animated: window != nil) }
  }

  @objc private func changed() {
    let checked = control.isOn
    onValueChange(["value": checked])
  }
}

final class SliderView: ControlView {
  let onSize = EventDispatcher()
  override var sizeEvent: EventDispatcher { onSize }
  let control = UISlider()
  let onValueChange = EventDispatcher()
  let onSlidingComplete = EventDispatcher()
  var step: Double = 0
  private var last: Double = .nan

  override var hosted: UIView { control }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    attach()
    control.maximumValue = 1
    control.addTarget(self, action: #selector(changed), for: .valueChanged)
    control.addTarget(self, action: #selector(ended), for: [.touchUpInside, .touchUpOutside, .touchCancel])
  }

  func setValue(_ value: Double) {
    last = value
    if !control.isTracking { control.setValue(Float(value), animated: false) }
  }

  func setRange(min: Double?, max: Double?) {
    if let min { control.minimumValue = Float(min) }
    if let max { control.maximumValue = Float(max) }
  }

  private var snapped: Double {
    let raw = Double(control.value)
    guard step > 0 else { return raw }
    let min = Double(control.minimumValue)
    return Swift.min(Double(control.maximumValue), min + (((raw - min) / step).rounded() * step))
  }

  @objc private func changed() {
    let value = snapped
    if step > 0 { control.value = Float(value) }
    guard value != last else { return }
    last = value
    onValueChange(["value": value])
  }

  @objc private func ended() {
    onSlidingComplete(["value": snapped])
  }
}

final class StepperView: ControlView {
  let onSize = EventDispatcher()
  override var sizeEvent: EventDispatcher { onSize }
  let control = UIStepper()
  let onValueChange = EventDispatcher()
  override var hosted: UIView { control }
  override var centred: Bool { true }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    attach()
    control.addTarget(self, action: #selector(changed), for: .valueChanged)
  }

  @objc private func changed() {
    onValueChange(["value": control.value])
  }
}

final class SegmentedControlView: ControlView {
  let onSize = EventDispatcher()
  override var sizeEvent: EventDispatcher { onSize }
  let control = UISegmentedControl()
  let onValueChange = EventDispatcher()
  private var items: [SegmentItem] = []
  private var selected: String?
  override var hosted: UIView { control }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    attach()
    control.addTarget(self, action: #selector(changed), for: .valueChanged)
  }

  func setItems(_ items: [SegmentItem]) {
    self.items = items
    control.removeAllSegments()
    for (index, item) in items.enumerated() {
      if let icon = item.icon, let image = UIImage(systemName: icon), item.label.isEmpty {
        control.insertSegment(with: image, at: index, animated: false)
      } else {
        control.insertSegment(withTitle: item.label, at: index, animated: false)
      }
      control.setEnabled(!item.disabled, forSegmentAt: index)
    }
    setSelected(selected)
    setNeedsLayout()
  }

  func setSelected(_ value: String?) {
    selected = value
    control.selectedSegmentIndex = items.firstIndex { $0.value == value } ?? UISegmentedControl.noSegment
  }

  @objc private func changed() {
    let index = control.selectedSegmentIndex
    guard items.indices.contains(index) else { return }
    let value = items[index].value
    // Held to the value React gives it, so a parent that doesn't take the change keeps the old one.
    setSelected(selected)
    onValueChange(["value": value])
  }
}

final class TabBarView: ControlView, UITabBarDelegate {
  let onSize = EventDispatcher()
  override var sizeEvent: EventDispatcher { onSize }
  let bar = UITabBar()
  let onValueChange = EventDispatcher()
  private var items: [TabItem] = []
  private var selected: String?
  override var hosted: UIView { bar }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    attach()
    bar.delegate = self
  }

  func setItems(_ items: [TabItem]) {
    self.items = items
    bar.setItems(
      items.enumerated().map { index, item in
        let image = item.icon.flatMap { UIImage(systemName: $0) }
        let chosen = (item.selectedIcon ?? item.icon).flatMap { UIImage(systemName: $0) }
        let tab = UITabBarItem(title: item.label, image: image, selectedImage: chosen)
        tab.tag = index
        tab.badgeValue = item.badge
        return tab
      },
      animated: false
    )
    setSelected(selected)
    if laidOut != bounds.size { setNeedsLayout() }
  }

  func setSelected(_ value: String?) {
    selected = value
    let index = items.firstIndex { $0.value == value }
    bar.selectedItem = index.flatMap { bar.items?[$0] }
  }

  private var laidOut: CGSize = .zero

  override func layoutSubviews() {
    super.layoutSubviews()
    // UIKit lays the tabs out for the size the bar first has, which here is a placeholder until
    // React Native gives it the size it asked for, and squeezes the labels to fit. Setting the
    // items again lays them out afresh.
    guard bounds.size != laidOut, bounds.height > 0 else { return }
    laidOut = bounds.size
    setItems(items)
  }

  func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
    guard items.indices.contains(item.tag) else { return }
    onValueChange(["value": items[item.tag].value])
  }
}

final class ButtonView: ControlView {
  let onSize = EventDispatcher()
  override var sizeEvent: EventDispatcher { onSize }
  let button = UIButton(type: .system)
  let onTrigger = EventDispatcher()
  let onMenuSelect = EventDispatcher()
  var label: String?
  var icon: String?
  var filled = false
  var size = "regular"
  var tint: UIColor?
  var destructive = false
  override var hosted: UIView { button }
  override var centred: Bool { true }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    attach()
    button.addTarget(self, action: #selector(pressed), for: .primaryActionTriggered)
    update()
  }

  func update() {
    var configuration: UIButton.Configuration
    if #available(iOS 26.0, *) {
      configuration = filled ? .prominentGlass() : .glass()
    } else {
      configuration = filled ? .borderedProminent() : .bordered()
      configuration.cornerStyle = .capsule
    }
    configuration.title = label
    if let icon { configuration.image = UIImage(systemName: icon) }
    configuration.imagePadding = 6
    switch size {
    case "small": configuration.buttonSize = .small
    case "large": configuration.buttonSize = .large
    default: configuration.buttonSize = .medium
    }
    let colour = destructive ? UIColor.systemRed : tint
    if filled {
      if let colour { configuration.baseBackgroundColor = colour }
    } else if let colour {
      configuration.baseForegroundColor = colour
    }
    // Just an icon makes a circle, as it does in iOS.
    if label?.isEmpty ?? true, icon != nil {
      let inset: CGFloat = size == "small" ? 6 : size == "large" ? 14 : 10
      configuration.contentInsets = NSDirectionalEdgeInsets(top: inset, leading: inset, bottom: inset, trailing: inset)
    }
    button.configuration = configuration
    button.tintColor = colour
    setNeedsLayout()
    report()
  }

  func setMenu(_ entries: [MenuEntry]?) {
    guard let entries, !entries.isEmpty else {
      button.menu = nil
      button.showsMenuAsPrimaryAction = false
      return
    }
    button.menu = UIMenu(children: entries.map { entry in
      var attributes: UIMenuElement.Attributes = []
      if entry.destructive { attributes.insert(.destructive) }
      if entry.disabled { attributes.insert(.disabled) }
      return UIAction(
        title: entry.label,
        image: entry.icon.flatMap { UIImage(systemName: $0) },
        attributes: attributes,
        state: entry.checked ? .on : .off
      ) { [weak self] _ in
        self?.onMenuSelect(["value": entry.value])
      }
    })
    button.showsMenuAsPrimaryAction = true
  }

  @objc private func pressed() {
    onTrigger()
  }
}
