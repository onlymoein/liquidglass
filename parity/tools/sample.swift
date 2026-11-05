// sample <png> mean x y w h | row y x0 x1 | col x y0 y1 — device pixels, read as sRGB.
import AppKit
let a = CommandLine.arguments
let image = NSImage(contentsOfFile: a[1])!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
let W = image.width, H = image.height
var px = [UInt8](repeating: 0, count: W * H * 4)
let ctx = CGContext(data: &px, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(image, in: CGRect(x: 0, y: 0, width: W, height: H))
func at(_ x: Int, _ y: Int) -> (Int, Int, Int) { let i = (y * W + x) * 4; return (Int(px[i]), Int(px[i + 1]), Int(px[i + 2])) }
func n(_ i: Int) -> Int { Int(a[i])! }
switch a[2] {
case "mean":
  var s = (0, 0, 0); let (x, y, w, h) = (n(3), n(4), n(5), n(6))
  for j in y..<y + h { for i in x..<x + w { let p = at(i, j); s.0 += p.0; s.1 += p.1; s.2 += p.2 } }
  let c = w * h
  print(String(format: "%.1f %.1f %.1f", Double(s.0) / Double(c), Double(s.1) / Double(c), Double(s.2) / Double(c)))
case "row": for x in n(4)...n(5) { let p = at(x, n(3)); print(x, p.0, p.1, p.2) }
case "col": for y in n(4)...n(5) { let p = at(n(3), y); print(y, p.0, p.1, p.2) }
default: break
}
