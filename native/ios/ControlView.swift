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

  private var given = false

  func setChecked(_ checked: Bool) {
    given = checked
    if control.isOn != checked { control.setOn(checked, animated: window != nil) }
  }

  /// Back to the value the app gave, after a change the app didn't take.
  func resync() {
    if control.isOn != given { control.setOn(given, animated: true) }
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

  private var given: Double = 0

  func setValue(_ value: Double) {
    given = value
    last = value
    if !control.isTracking { control.setValue(Float(value), animated: false) }
  }

  /// Back to the value the app gave, after a change the app didn't take. Not while it's held.
  func resync() {
    guard !control.isTracking else { return }
    last = given
    if control.value != Float(given) { control.setValue(Float(given), animated: true) }
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

  private var given: Double = 0

  func setValue(_ value: Double) {
    given = value
    control.value = value
  }

  /// Back to the value the app gave, after a change the app didn't take.
  func resync() {
    if control.value != given { control.value = given }
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

  var fontFamily: String? {
    didSet { applyFont() }
  }

  private func applyFont() {
    // iOS 26 sets segments at 14 points, earlier versions at 13; the selected one a little heavier.
    let size: CGFloat
    if #available(iOS 26.0, *) { size = 14 } else { size = 13 }
    if let regular = Fonts.named(fontFamily, size: size, weight: .regular) {
      control.setTitleTextAttributes([.font: regular], for: .normal)
      control.setTitleTextAttributes([.font: Fonts.named(fontFamily, size: size, weight: .medium) ?? regular], for: .selected)
    } else {
      control.setTitleTextAttributes(nil, for: .normal)
      control.setTitleTextAttributes(nil, for: .selected)
    }
    setNeedsLayout()
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

  /// Back to the segment the app gave, after a change the app didn't take.
  func resync() {
    setSelected(selected)
  }

  @objc private func changed() {
    let index = control.selectedSegmentIndex
    guard items.indices.contains(index) else { return }
    onValueChange(["value": items[index].value])
  }
}

final class TabBarView: ControlView, UITabBarDelegate {
  let onSize = EventDispatcher()
  override var sizeEvent: EventDispatcher { onSize }
  let bar = UITabBar()
  let onValueChange = EventDispatcher()
  /// Where each tab is on the screen, for anything that points one out, such as an intro tour.
  let onTabLayout = EventDispatcher()
  /// The selected tab's colour, if the app gives one. UIKit's own is the system blue.
  var tint: UIColor? {
    didSet { bar.tintColor = tint }
  }

  /// The minimised bar was tapped: the app is asked for the whole bar back.
  let onExpand = EventDispatcher()

  /// Minimised, as iOS 27 minimises a tab bar when a page scrolls down: the bar draws into a glass
  /// capsule at its leading end, 49 by 39 points, showing the selected tab's icon.
  private lazy var mini: UIButton = {
    var config = TabBarView.capsule()
    let button = UIButton(configuration: config)
    button.addAction(UIAction { [weak self] _ in self?.onExpand([:]) }, for: .primaryActionTriggered)
    button.accessibilityLabel = "Show tabs"
    button.alpha = 0
    button.isHidden = true
    addSubview(button)
    return button
  }()

  var minimized = false {
    didSet {
      guard minimized != oldValue else { return }
      shrink(animated: window != nil)
    }
  }

  /// iOS 26's glass for the capsule, or a grey one before it.
  private static func capsule() -> UIButton.Configuration {
    var config: UIButton.Configuration
    if #available(iOS 26.0, *) { config = .glass() } else { config = .gray() }
    config.cornerStyle = .capsule
    return config
  }

  private func miniFrame() -> CGRect {
    // Where the capsule's leading end is: from where UIKit put the tabs, or iOS 27's own margins.
    let tabs = measured.compactMap { tab -> CGRect? in
      guard let x = tab["x"] as? CGFloat, let y = tab["y"] as? CGFloat, let w = tab["width"] as? CGFloat, let h = tab["height"] as? CGFloat else { return nil }
      return convert(CGRect(x: x, y: y, width: w, height: h), from: nil)
    }
    if let first = tabs.min(by: { $0.minX < $1.minX }), let deepest = tabs.map(\.maxY).max() {
      return CGRect(x: max(0, first.minX - 4), y: deepest + 4 - 39, width: 49, height: 39)
    }
    return CGRect(x: 21, y: bounds.height - 21 - 39, width: 49, height: 39)
  }

  private func shrink(animated: Bool) {
    let frame = miniFrame()
    mini.frame = frame
    var config = mini.configuration ?? TabBarView.capsule()
    let item = items.first { $0.value == selected }
    // In the selected tab's colour, as the bar shows it. Glass buttons draw their symbols in the
    // label colour whatever they're given, so the colour goes into the image itself.
    let colour = tint ?? .systemBlue
    config.image = item.flatMap { Images.icon(uri: $0.selectedIconUri ?? $0.iconUri, symbol: $0.selectedIcon ?? $0.icon, size: 20)?.withTintColor(colour, renderingMode: .alwaysOriginal) }
    mini.configuration = config
    mini.isHidden = false
    // The bar draws in towards the capsule, about the capsule's middle, as it fades.
    let centre = CGPoint(x: bar.bounds.midX, y: bar.bounds.midY)
    let towards = CGPoint(x: frame.midX - bar.frame.minX, y: frame.midY - bar.frame.minY)
    let sx = frame.width / max(1, bar.bounds.width)
    let sy = min(1, frame.height / 62)
    let small = CGAffineTransform(translationX: (towards.x - centre.x) * (1 - sx), y: (towards.y - centre.y) * (1 - sy)).scaledBy(x: sx, y: sy)
    let change = {
      self.bar.transform = self.minimized ? small : .identity
      self.bar.alpha = self.minimized ? 0 : 1
      self.mini.alpha = self.minimized ? 1 : 0
      self.mini.transform = self.minimized ? .identity : CGAffineTransform(scaleX: 1.6, y: 1.2)
    }
    let done: (Bool) -> Void = { _ in if !self.minimized { self.mini.isHidden = true } }
    if animated {
      if minimized { mini.transform = CGAffineTransform(scaleX: 1.6, y: 1.2) }
      UIView.animate(withDuration: 0.42, delay: 0, usingSpringWithDamping: 0.8, initialSpringVelocity: 0, options: [.allowUserInteraction, .beginFromCurrentState], animations: change, completion: done)
    } else {
      change()
      done(true)
    }
    bar.isUserInteractionEnabled = !minimized
  }

  /// Minimised, only the capsule takes a touch: the rest of the bar's box lets it through.
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard minimized else { return super.hitTest(point, with: event) }
    return mini.frame.contains(point) ? mini : nil
  }
  private var items: [TabItem] = []
  private var selected: String?
  override var hosted: UIView { bar }

  var fontFamily: String? {
    didSet { setItems(items) }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    attach()
    bar.delegate = self
  }

  func setItems(_ items: [TabItem]) {
    self.items = items
    let regular = Fonts.named(fontFamily, size: 10, weight: .medium)
    bar.setItems(
      items.enumerated().map { index, item in
        let image = Images.icon(uri: item.iconUri, symbol: item.icon, size: 25)
        let chosen = Images.icon(uri: item.selectedIconUri ?? item.iconUri, symbol: item.selectedIcon ?? item.icon, size: 25)
        let tab = UITabBarItem(title: item.label, image: image, selectedImage: chosen)
        tab.tag = index
        tab.badgeValue = item.badge
        tab.accessibilityIdentifier = item.testID
        if let label = item.accessibilityLabel { tab.accessibilityLabel = label }
        if let regular {
          tab.setTitleTextAttributes([.font: regular], for: .normal)
          tab.setTitleTextAttributes([.font: regular], for: .selected)
        }
        return tab
      },
      animated: false
    )
    setSelected(selected)
    if laidOut != bounds.size { setNeedsLayout() }
    measureTabs()
  }

  func setSelected(_ value: String?) {
    selected = value
    let index = items.firstIndex { $0.value == value }
    bar.selectedItem = index.flatMap { bar.items?[$0] }
    // Minimised, the capsule shows the tab that's now selected.
    if minimized { shrink(animated: false) }
  }

  /// Back to the tab the app gave, after a tap the app didn't take. UIKit moves the selection
  /// itself on a tap, before the app has had a say.
  func resync() {
    setSelected(selected)
  }

  private var laidOut: CGSize = .zero

  override func layoutSubviews() {
    super.layoutSubviews()
    // UIKit lays the tabs out for the size the bar first has, which here is a placeholder until
    // React Native gives it the size it asked for, and squeezes the labels to fit. Setting the
    // items again lays them out afresh.
    measureTabs()
    if minimized { mini.frame = miniFrame() }
    guard bounds.size != laidOut, bounds.height > 0 else { return }
    laidOut = bounds.size
    setItems(items)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    measureTabs()
  }

  private var measured: [[String: Any]] = []

  /// Finds where UIKit drew each tab, once it has laid them out. The tabs' own views are
  /// UIKit's private ones, so each is found the way VoiceOver finds it, by what it's called;
  /// failing that, the bar is shared out evenly.
  private func measureTabs() {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.window != nil, !self.items.isEmpty else { return }
      var spoken: [UIView] = []
      func look(_ view: UIView) {
        if view.isAccessibilityElement { spoken.append(view) }
        view.subviews.forEach(look)
      }
      look(self.bar)
      let tabs: [[String: Any]] = self.items.enumerated().map { index, item in
        let match = spoken.first { view in
          if let id = item.testID, view.accessibilityIdentifier == id { return true }
          let said = view.accessibilityLabel ?? ""
          return said == (item.accessibilityLabel ?? item.label) || said.hasPrefix(item.label)
        }
        let frame: CGRect
        if let match {
          frame = match.convert(match.bounds, to: nil)
        } else {
          let whole = self.bar.convert(self.bar.bounds, to: nil)
          let each = whole.width / CGFloat(self.items.count)
          frame = CGRect(x: whole.minX + each * CGFloat(index), y: whole.minY, width: each, height: min(whole.height, 49))
        }
        return ["value": item.value, "x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]
      }
      guard !NSArray(array: tabs).isEqual(to: self.measured) else { return }
      self.measured = tabs
      self.onTabLayout(["tabs": tabs])
    }
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
  var iconUri: String?
  var fontFamily: String?
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
    configuration.image = Images.icon(uri: iconUri, symbol: icon, size: size == "small" ? 17 : size == "large" ? 26 : 21)
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
      // iOS 26's glass button keeps its symbol and title in the label colour whatever the base
      // foreground says, so a destructive button would come out black. A symbol drawn in its own
      // colour, and a title given one, win over that.
      configuration.imageColorTransformer = UIConfigurationColorTransformer { _ in colour }
      if let image = configuration.image {
        configuration.image = image.withTintColor(colour, renderingMode: .alwaysOriginal)
      }
    }
    // The title in the app's own typeface, if it gave one, at the size and weight UIKit chose, and
    // in the button's colour where iOS would otherwise keep it in the label colour.
    let family = fontFamily
    let titleColour = filled ? nil : colour
    if family != nil || titleColour != nil {
      configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
        var attributes = attributes
        if let titleColour { attributes.foregroundColor = titleColour }
        if let family {
          let current = attributes.font ?? UIFont.preferredFont(forTextStyle: .body)
          if let font = Fonts.named(family, size: current.pointSize, weight: Fonts.weight(of: current)) { attributes.font = font }
        }
        return attributes
      }
    }
    // Just an icon makes a circle, as it does in iOS.
    if label?.isEmpty ?? true, icon != nil || iconUri != nil {
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

/// The app's own typefaces, found by the name it uses for them.
enum Fonts {
  /// A face of `family` at this size, as near this weight as the family has, or nil if there's no
  /// such family. `family` can be a face's own name, such as "Poppins-Medium", or a family's, such
  /// as "Poppins".
  static func named(_ family: String?, size: CGFloat, weight: UIFont.Weight) -> UIFont? {
    guard let family, !family.isEmpty else { return nil }
    if let font = UIFont(name: family, size: size) { return font }
    let key = simple(family)
    guard let found = UIFont.familyNames.first(where: { simple($0) == key }) else {
      NSLog("[liquidglass] No font named \"%@\" is loaded; the system font is used instead.", family)
      return nil
    }
    let faces = UIFont.fontNames(forFamilyName: found)
    let wanted = words(for: weight)
    let face = faces.first { face in wanted.contains { simple(face).hasSuffix($0) } }
      ?? faces.first { simple($0).hasSuffix("regular") }
      ?? faces.first
    return face.flatMap { UIFont(name: $0, size: size) }
  }

  static func weight(of font: UIFont) -> UIFont.Weight {
    let traits = font.fontDescriptor.object(forKey: .traits) as? [UIFontDescriptor.TraitKey: Any]
    return UIFont.Weight(rawValue: traits?[.weight] as? CGFloat ?? 0)
  }

  private static func simple(_ name: String) -> String {
    name.lowercased().filter { $0.isLetter || $0.isNumber }
  }

  private static func words(for weight: UIFont.Weight) -> [String] {
    switch weight.rawValue {
    case ..<(-0.3): return ["light"]
    case ..<0.1: return ["regular", "book", "normal"]
    case ..<0.27: return ["medium"]
    case ..<0.35: return ["semibold", "demibold"]
    default: return ["bold"]
    }
  }
}

/// Icons: an SF Symbol by name, or the app's own image, sized to sit where a symbol would.
enum Images {
  static func icon(uri: String?, symbol: String?, size: CGFloat) -> UIImage? {
    if let uri, !uri.isEmpty, let image = load(uri) { return fit(image, size) }
    return symbol.flatMap { UIImage(systemName: $0) }
  }

  private static var cache: [String: UIImage] = [:]

  private static func load(_ uri: String) -> UIImage? {
    if let image = cache[uri] { return image }
    var image: UIImage?
    if let url = URL(string: uri), url.scheme != nil {
      // A file from the app, or in development a file from Metro.
      if url.isFileURL {
        image = UIImage(contentsOfFile: url.path)
      } else if let data = try? Data(contentsOf: url) {
        image = UIImage(data: data, scale: UIScreen.main.scale)
      }
    } else {
      image = UIImage(named: uri) ?? UIImage(contentsOfFile: uri)
    }
    if image == nil { NSLog("[liquidglass] Couldn't load the icon at %@.", uri) }
    if let image { cache[uri] = image }
    return image
  }

  /// Scaled to fit a square `size` points across, and drawn in the tint, as a symbol is.
  private static func fit(_ image: UIImage, _ size: CGFloat) -> UIImage {
    let ratio = min(size / max(image.size.width, 1), size / max(image.size.height, 1))
    let target = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
    let fitted = UIGraphicsImageRenderer(size: target).image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
    return fitted.withRenderingMode(.alwaysTemplate)
  }
}
