// Renders one scene of real iOS glass, or the same scene in a web view, so the
// two can be measured under the same conditions. See ../README.md.
import SwiftUI
import WebKit

func argument(_ name: String, _ fallback: String) -> String {
  let args = ProcessInfo.processInfo.arguments
  guard let i = args.firstIndex(of: "-\(name)"), i + 1 < args.count else { return fallback }
  return args[i + 1]
}
func number(_ name: String, _ fallback: CGFloat) -> CGFloat { CGFloat(Double(argument(name, "")) ?? Double(fallback)) }

func color(_ hex: String) -> Color {
  let v = Int(hex, radix: 16) ?? 0
  return Color(.sRGB, red: Double(v >> 16 & 255) / 255, green: Double(v >> 8 & 255) / 255, blue: Double(v & 255) / 255)
}

@main struct ParityApp: App {
  var body: some Scene { WindowGroup { Root().ignoresSafeArea().statusBarHidden() } }
}

struct Root: View {
  var body: some View {
    if argument("engine", "native") == "web" { Web().ignoresSafeArea() } else { Native() }
  }
}

struct Web: UIViewRepresentable {
  func makeUIView(context: Context) -> WKWebView {
    let view = WKWebView()
    view.scrollView.contentInsetAdjustmentBehavior = .never
    view.scrollView.topEdgeEffect.isHidden = true
    view.scrollView.bottomEdgeEffect.isHidden = true
    let query = ["scene", "bg", "kind", "w", "h", "r", "x", "y", "edge", "mark", "gap"].map { "\($0)=\(argument($0, ""))" }.joined(separator: "&")
    let page = Bundle.main.url(forResource: "index", withExtension: "html")!
    view.loadFileURL(URL(string: "\(page.absoluteString)?\(query)")!, allowingReadAccessTo: Bundle.main.bundleURL)
    return view
  }
  func updateUIView(_ view: WKWebView, context: Context) {}
}

struct Backdrop: View {
  var body: some View {
    let bg = argument("bg", "ffffff")
    let edge = number("edge", 0)
    if edge > 0 {
      HStack(spacing: 0) { Color.black.frame(width: edge); Color.white }.frame(width: 402, height: 874)
    } else
    if let path = Bundle.main.path(forResource: bg, ofType: "png"), let image = UIImage(contentsOfFile: path) {
      Image(uiImage: image).resizable().interpolation(.none).frame(width: 402, height: 874)
    } else {
      color(bg).frame(width: 402, height: 874)
    }
  }
}

// The backdrop at the screen's own origin, whatever safe area a container gives it.
struct Full: View {
  var body: some View {
    Color.clear.overlay(alignment: .top) { Backdrop() }.ignoresSafeArea()
  }
}

// The other controls, each as iOS draws it, for measuring.
struct Gallery: View {
  @State var pick = 0
  @State var count = 2
  @State var presented = true
  @State var text = ""
  @State var shown = false
  var body: some View {
    let scene = argument("scene", "panel")
    ZStack(alignment: .top) {
      Backdrop().ignoresSafeArea().onTapGesture { shown = true }
      switch scene {
      case "controls":
        VStack(spacing: 34) {
          Picker("", selection: $pick) { Text("Boxes").tag(0); Text("Pallets").tag(1); Text("Skids").tag(2) }.pickerStyle(.segmented).frame(width: 300)
          Stepper("", value: $count).labelsHidden()
          ProgressView(value: 0.5).frame(width: 300)
          ProgressView()
          TextField("Text field", text: $text).textFieldStyle(.roundedBorder).frame(width: 300)
          Button("Small") {}.buttonStyle(.glass).controlSize(.small)
          Button("Mini") {}.buttonStyle(.glass).controlSize(.mini)
          Button("XLarge") {}.buttonStyle(.glass).controlSize(.extraLarge)
          Button {} label: { Image(systemName: "plus") }.buttonStyle(.glass)
          Button {} label: { Image(systemName: "plus") }.buttonStyle(.glass).buttonBorderShape(.circle).controlSize(.large)
        }.padding(.top, 90)
      case "menu", "context":
        VStack(spacing: 40) {
          if scene == "menu" {
            Menu {
              Button("Parcel", systemImage: "shippingbox") {}
              Button("Freight", systemImage: "truck.box") {}
              Divider()
              Button("Delete", systemImage: "trash", role: .destructive) {}
            } label: { Label("Create shipment", systemImage: "plus") }.buttonStyle(.glass).controlSize(.large).accessibilityIdentifier("target")
          } else {
            Text("Hold me").padding(30).glassEffect(.regular, in: .rect(cornerRadius: 24)).accessibilityIdentifier("target")
              .contextMenu { Button("Copy", systemImage: "doc.on.doc") {}; Button("Delete", systemImage: "trash", role: .destructive) {} }
          }
        }.padding(.top, 240)
      default: EmptyView()
      }
    }
    .sheet(isPresented: Binding(get: { scene == "sheet" || (scene == "show-sheet" && shown) }, set: { shown = $0 })) {
      VStack { Text("Sheet title").font(.headline); Text("Body") }.presentationDetents([.medium, .large])
    }
    .alert("Delete shipment?", isPresented: Binding(get: { scene == "alert" || (scene == "show-alert" && shown) }, set: { shown = $0 })) {
      Button("Cancel", role: .cancel) {}; Button("Delete", role: .destructive) {}
    } message: { Text("This can't be undone.") }
    .confirmationDialog("Delete shipment?", isPresented: Binding(get: { scene == "dialog" }, set: { _ in }), titleVisibility: .visible) {
      Button("Delete", role: .destructive) {}; Button("Cancel", role: .cancel) {}
    }
  }
}

struct Merge: View {
  var body: some View {
    let gap = number("gap", 30)
    ZStack(alignment: .top) {
      Backdrop().ignoresSafeArea()
      GlassEffectContainer(spacing: 20) {
        HStack(spacing: gap) {
          Image(systemName: "plus").frame(width: 60, height: 60).glassEffect(.regular, in: .circle)
          Image(systemName: "pencil").frame(width: 60, height: 60).glassEffect(.regular, in: .circle)
        }
      }.padding(.top, 270)
    }.frame(width: 402, height: 874).ignoresSafeArea()
  }
}

struct Scrolling: View {
  @State var tab = 0
  var body: some View {
    TabView(selection: $tab) {
      Tab("Home", systemImage: "house.fill", value: 0) { ScrollView { Backdrop(); Backdrop() }.ignoresSafeArea() }
      Tab("Search", systemImage: "magnifyingglass", value: 1) { Backdrop() }
      Tab("Settings", systemImage: "gearshape.fill", value: 2) { Backdrop() }
    }.tabBarMinimizeBehavior(.onScrollDown)
  }
}

struct Navigation: View {
  @State var text = ""
  var body: some View {
    NavigationStack {
      ZStack { Backdrop().ignoresSafeArea() }
        .navigationTitle("Shipments")
        .toolbar {
          ToolbarItem(placement: .topBarLeading) { Button("Back", systemImage: "chevron.left") {} }
          ToolbarItemGroup(placement: .topBarTrailing) { Button("Share", systemImage: "square.and.arrow.up") {}; Button("Edit", systemImage: "pencil") {} }
          ToolbarItem(placement: .bottomBar) { Button("Add", systemImage: "plus") {} }
        }
        .searchable(text: $text, prompt: "Search")
    }
  }
}

struct Native: View {
  @State var on = true
  @State var value = 0.5
  @State var tab = 0
  var body: some View {
    if ["controls", "menu", "context", "sheet", "alert", "dialog", "show-sheet", "show-alert"].contains(argument("scene", "panel")) {
      Gallery()
    } else if argument("scene", "panel") == "merge" {
      Merge()
    } else if argument("scene", "panel") == "minimize" {
      Scrolling()
    } else if argument("scene", "panel") == "navigation" {
      Navigation()
    } else if argument("scene", "panel") == "all" {
      ZStack(alignment: .top) {
        Backdrop()
        VStack(spacing: 0) {
          Text("Glass panel").frame(width: 300, height: 90).glassEffect(.regular, in: .rect(cornerRadius: 28)).frame(height: 120)
          row { Button("Continue") {}.buttonStyle(.glass) }
          row { Button("Continue") {}.buttonStyle(.glassProminent) }
          row { Button("Continue") {}.buttonStyle(.glass).controlSize(.large) }
          row { Button("Continue") {}.buttonStyle(.glassProminent).controlSize(.large) }
          row { Toggle("", isOn: $on).labelsHidden() }
          row { Slider(value: $value).frame(width: 300) }
          row { Text("Clear glass").frame(width: 300, height: 60).glassEffect(.clear, in: .rect(cornerRadius: 30)) }
        }.padding(.top, 90)
      }.frame(width: 402, height: 874).ignoresSafeArea()
    } else if argument("scene", "panel") == "tabs" {
      TabView(selection: $tab) {
        Tab("Home", systemImage: "house.fill", value: 0) { Full() }
        Tab("Search", systemImage: "magnifyingglass", value: 1) { Full() }
        Tab("Settings", systemImage: "gearshape.fill", value: 2) { Full() }
      }
    } else {
      ZStack(alignment: .topLeading) {
        Backdrop()
        element.position(x: number("x", 201), y: number("y", 300))
      }
      .frame(width: 402, height: 874).ignoresSafeArea()
    }
  }
  func row<C: View>(@ViewBuilder _ c: () -> C) -> some View { c().frame(maxWidth: .infinity).frame(height: 60) }
  @ViewBuilder var element: some View {
    let w = number("w", 300), h = number("h", 120), r = number("r", 28)
    switch argument("kind", "regular") {
    case "regular": Color.clear.frame(width: w, height: h).glassEffect(.regular, in: .rect(cornerRadius: r))
    case "clear": Color.clear.frame(width: w, height: h).glassEffect(.clear, in: .rect(cornerRadius: r))
    case "tint": Color.clear.frame(width: w, height: h).glassEffect(.regular.tint(.blue), in: .rect(cornerRadius: r))
    case "button": Button("Continue") {}.buttonStyle(.glass)
    case "button-large": Button("Continue") {}.buttonStyle(.glass).controlSize(.large)
    case "filled": Button("Continue") {}.buttonStyle(.glassProminent)
    case "filled-large": Button("Continue") {}.buttonStyle(.glassProminent).controlSize(.large)
    case "switch": Toggle("", isOn: $on).labelsHidden()
    case "slider": Slider(value: $value).frame(width: w)
    default: EmptyView()
    }
  }
}
