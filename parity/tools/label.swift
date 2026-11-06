// label <out.png> <title>: the heading of a comparison video, 1012 x 130.
import AppKit

let args = CommandLine.arguments
let size = NSSize(width: 1012, height: 130)
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1012, pixelsHigh: 130, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = size
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor.black.setFill()
NSRect(origin: .zero, size: size).fill()
func text(_ string: String, centre: CGFloat, y: CGFloat, size: CGFloat) {
  let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: size), .foregroundColor: NSColor.white]
  let width = (string as NSString).size(withAttributes: attributes).width
  (string as NSString).draw(at: NSPoint(x: centre - width / 2, y: y), withAttributes: attributes)
}
text(args[2], centre: 506, y: 84, size: 28)
text("Native iOS 27 (SwiftUI)", centre: 253, y: 22, size: 28)
text("liquidglass (React)", centre: 759, y: 22, size: 28)
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[1]))
