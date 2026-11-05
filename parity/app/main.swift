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
    let query = ["scene", "bg", "kind", "w", "h", "r", "x", "y", "edge", "mark"].map { "\($0)=\(argument($0, ""))" }.joined(separator: "&")
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

struct Native: View {
  @State var on = true
  @State var value = 0.5
  @State var tab = 0
  var body: some View {
    if argument("scene", "panel") == "all" {
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
        Tab("Home", systemImage: "house.fill", value: 0) { Backdrop().ignoresSafeArea() }
        Tab("Search", systemImage: "magnifyingglass", value: 1) { Backdrop().ignoresSafeArea() }
        Tab("Settings", systemImage: "gearshape.fill", value: 2) { Backdrop().ignoresSafeArea() }
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
