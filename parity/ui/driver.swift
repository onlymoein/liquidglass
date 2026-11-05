// Runs gestures for the rig. It watches a command file on the Mac and acts on each
// new line, so the same tap reaches real iOS controls and the web page alike.
import XCTest

final class Driver: XCTestCase {
  func testDrive() throws {
    let root = ProcessInfo.processInfo.environment["PARITY_DIR"] ?? "/tmp/parity"
    let commands = root + "/commands.txt", done = root + "/done.txt"
    let app = XCUIApplication(bundleIdentifier: "local.liquidglass.parity")
    var seen = 0
    let started = Date()
    func at(_ x: Double, _ y: Double) -> XCUICoordinate {
      app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y))
    }
    while Date().timeIntervalSince(started) < 3600 {
      let lines = ((try? String(contentsOfFile: commands, encoding: .utf8)) ?? "").split(separator: "\n").map(String.init)
      if lines.count > seen {
        for line in lines[seen...] {
          let p = line.split(separator: " ").map(String.init), n = p.dropFirst().compactMap { Double($0) }
          switch p[0] {
          case "launch": app.terminate(); app.launchArguments = Array(p.dropFirst()); app.launch()
          case "tap": at(n[0], n[1]).tap()
          case "press": at(n[0], n[1]).press(forDuration: n[2])
          case "drag": at(n[0], n[1]).press(forDuration: n[4], thenDragTo: at(n[2], n[3]))
          case "stop": return
          default: break
          }
        }
        seen = lines.count
        try? "\(seen)".write(toFile: done, atomically: true, encoding: .utf8)
      }
      Thread.sleep(forTimeInterval: 0.05)
    }
  }
}
