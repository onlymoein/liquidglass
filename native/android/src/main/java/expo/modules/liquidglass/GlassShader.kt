package expo.modules.liquidglass

// The glass, as one shader run over what's behind it. It follows the web version's optics
// (src/internal/refraction.ts): near the rim each point shows what lies further in, by up to a
// third of the glass's height at the very edge and falling in a straight line to nothing across
// the bezel. Then the face is toned as iOS tones it: contrast, brightness and saturation, in
// that order, as CSS filters apply them. Last comes the lit hairline along the top and bottom.
//
// `content` is what's behind the glass, already blurred, drawn `margin` pixels beyond the glass
// on every side so the rim has something to reach for.
internal const val GLASS_SHADER = """
uniform shader content;
uniform float2 size;
uniform float margin;
uniform float radius;
uniform float bezel;
uniform float reach;
uniform float density;
uniform float contrast;
uniform float brightness;
uniform float saturation;
uniform float shine;
uniform float zoom;
uniform float split;
uniform float lens;
uniform half3 base;
uniform half4 tint;

half4 main(float2 coord) {
  float2 half_size = size * 0.5;
  float2 p = coord - margin - half_size;
  float r = min(radius, min(half_size.x, half_size.y));
  float2 q = abs(p) - (half_size - r);
  float2 o = max(q, 0.0);
  float l = length(o);
  // How far in from the rim the point is, and which way is out.
  float d = r - (l + min(max(q.x, q.y), 0.0));
  float2 n;
  if (l > 0.0) {
    n = (o / l) * sign(p);
  } else if (q.x > q.y) {
    n = float2(sign(p.x), 0.0);
  } else {
    n = float2(0.0, sign(p.y));
  }

  // A pane pulls in what lies further in, by an amount that falls in a straight line across the
  // bezel. A lens, like a held thumb, bends light as a curved surface does, steeply at the very
  // rim, and shows there what lies just outside it.
  float shift = 0.0;
  if (d >= 0.0 && d < bezel) {
    float t = 1.0 - d / bezel;
    shift = lens > 0.5 ? -reach * t * t * t : reach * t;
  }
  // A lens enlarges what's under it about its middle, then bends it at the rim. Its colours
  // part there, red bending furthest, as light through a real lens does.
  float2 middle = margin + half_size;
  float2 from = middle + (coord - middle) / zoom;
  float2 bend = n * shift;
  half4 seen = content.eval(from - bend);
  if (split > 0.0) {
    seen.r = content.eval(from - bend * (1.0 + split)).r;
    seen.b = content.eval(from - bend * (1.0 - split)).b;
  }
  // Where nothing was drawn, the window shows through.
  half3 rgb = seen.rgb + base * (1.0 - seen.a);

  rgb = (rgb - 0.5) * contrast + 0.5;
  rgb *= brightness;
  half grey = dot(rgb, half3(0.2126, 0.7152, 0.0722));
  rgb = clamp(mix(half3(grey), rgb, saturation), 0.0, 1.0);
  rgb = mix(rgb, tint.rgb, tint.a);

  // The hairline of light along the top and bottom, strongest right at the rim.
  float points = max(d, 0.0) / density;
  float light = n.y * n.y * max(0.0, 0.39 - 0.29 * points) * shine;
  rgb += (1.0 - rgb) * light;
  return half4(rgb, 1.0);
}
"""
