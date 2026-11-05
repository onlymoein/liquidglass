// frames <movie> <outdir> <from s> <to s> <every s>: writes frames as PNGs.
import AVFoundation
import AppKit
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let gen = AVAssetImageGenerator(asset: asset)
gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
var t = Double(a[3])!; let end = Double(a[4])!, step = Double(a[5])!; var i = 0
while t <= end {
  if let im = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) {
    try! NSBitmapImageRep(cgImage: im).representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(a[2])/\(String(format: "%04d", i)).png"))
  }
  t += step; i += 1
}
print(i)
