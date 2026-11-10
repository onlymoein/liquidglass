package expo.modules.liquidglass

// The glass, as one shader run over what's behind it. It follows the web version's optics
// (src/internal/refraction.ts): near the rim each point shows what lies further in, by up to a
// third of the glass's height at the very edge and falling in a straight line to nothing across
// the bezel. Then the face is toned as iOS tones it: contrast, brightness and saturation, in
// that order, as CSS filters apply them. Last comes the lit hairline along the two edges that face
// the light, which follows the phone as it tilts.
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
uniform float2 light;

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

  // The hairline of light along the edges facing the light and away from it, strongest right at
  // the rim. Upright, that's the top and bottom.
  float points = max(d, 0.0) / density;
  float facing = dot(n, light);
  float lit = facing * facing * max(0.0, 0.39 - 0.29 * points) * shine;
  rgb += (1.0 - rgb) * lit;
  return half4(rgb, 1.0);
}
"""

// Glass in a group, drawn as one surface. Each piece is a rounded rectangle, and their distance
// fields are blended where they come within `spacing` of each other, so pieces that come close
// flow together as iOS glass does in a container. It's the web version's blend
// (src/internal/contour.ts). The optics are the pane's, with the rim and its direction taken from
// the blended shape, and the edge is smoothed over a pixel since there's no clip to do it.
internal const val GROUP_SHADER = """
uniform shader content;
uniform float4 rects[8];
uniform float radii[8];
uniform float count;
uniform float spacing;
uniform float bezel;
uniform float reach;
uniform float density;
uniform float contrast;
uniform float brightness;
uniform float saturation;
uniform float shine;
uniform half3 base;
uniform float2 light;

float box(float2 p, float4 r, float radius) {
  float2 half_size = r.zw * 0.5;
  float2 q = abs(p - r.xy - half_size) - half_size + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float field(float2 p) {
  float f = 100000.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) < count) {
      float next = box(p, rects[i], radii[i]);
      float h = max(spacing - abs(f - next), 0.0) / max(spacing, 0.001);
      f = min(f, next) - h * h * spacing * 0.25;
    }
  }
  return f;
}

half4 main(float2 coord) {
  float f = field(coord);
  if (f > 1.0) return half4(0.0);
  float2 g = float2(field(coord + float2(1.0, 0.0)) - field(coord - float2(1.0, 0.0)),
                    field(coord + float2(0.0, 1.0)) - field(coord - float2(0.0, 1.0)));
  float2 n = length(g) > 0.0001 ? normalize(g) : float2(0.0, 1.0);
  float d = -f;

  float shift = 0.0;
  if (d >= 0.0 && d < bezel) shift = reach * (1.0 - d / bezel);
  half4 seen = content.eval(coord - n * shift);
  half3 rgb = seen.rgb + base * (1.0 - seen.a);

  rgb = (rgb - 0.5) * contrast + 0.5;
  rgb *= brightness;
  half grey = dot(rgb, half3(0.2126, 0.7152, 0.0722));
  rgb = clamp(mix(half3(grey), rgb, saturation), 0.0, 1.0);

  float points = max(d, 0.0) / density;
  float facing = dot(n, light);
  float lit = facing * facing * max(0.0, 0.39 - 0.29 * points) * shine;
  rgb += (1.0 - rgb) * lit;

  half alpha = clamp(0.5 - f, 0.0, 1.0);
  return half4(rgb * alpha, alpha);
}
"""
