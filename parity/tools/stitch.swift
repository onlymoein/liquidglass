// stitch <out.png> <a.png> <b.png> ...: side by side, full size, for looking at.
import AppKit
let a = Array(CommandLine.arguments.dropFirst()); let images = a.dropFirst().map { NSImage(contentsOfFile: $0)! }
let w = 1206, h = 2622, gap = 24, n = images.count
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: (w + gap) * n - gap, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor.black.setFill(); NSRect(x: 0, y: 0, width: (w + gap) * n, height: h).fill()
for (i, im) in images.enumerated() { im.draw(in: NSRect(x: (w + gap) * i, y: 0, width: w, height: h)) }
NSGraphicsContext.restoreGraphicsState(); try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[0]))
