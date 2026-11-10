package expo.modules.liquidglass

// The glass, as one shader run over what's behind it. It follows the web version's optics and its
// measurements of iOS (src/internal/refraction.ts):
//
// - The shape. iOS's corners are continuous: the curve starts further along the edge than a
//   circle's would. A corner that long needs room, so a capsule stays circular, as on iOS.
// - The bend. Near the rim each point shows what lies further in, by up to a third of the glass's
//   height at the very edge, falling in a straight line to nothing across the bezel.
// - The tone: contrast, brightness and saturation, in that order, as CSS filters apply them.
// - The rim. A bright line along the edges that face the light and away from it, a dark hairline
//   just outside the shape, strongest along the other two sides, and a faint shade inside. The
//   light follows the phone as it tilts; upright, it's straight above.
//
// `content` is what's behind the glass, already blurred, drawn `margin` pixels beyond the glass on
// every side so the rim has something to reach for. The shader draws the edge itself, smoothed
// over a pixel, so the glass needs no clip.

/** How far in from the rim a point is, in pixels, and which way is out: (distance, nx, ny). */
private const val EDGE = """
float3 edge(float2 p, float2 half_size, float radius) {
  float reach = radius * 1.2;
  if (radius > 0.0 && reach <= min(half_size.x, half_size.y)) {
    float a = abs(p.x) - (half_size.x - reach);
    float b = abs(p.y) - (half_size.y - reach);
    if (a > 0.0 && b > 0.0) {
      float u = a / reach;
      float v = b / reach;
      float g = pow(pow(u, 2.5) + pow(v, 2.5), 0.4);
      float gx = pow(u / g, 1.5);
      float gy = pow(v / g, 1.5);
      float norm = length(float2(gx, gy));
      return float3((1.0 - g) * reach / norm, gx / norm * sign(p.x), gy / norm * sign(p.y));
    }
    float dx = half_size.x - abs(p.x);
    float dy = half_size.y - abs(p.y);
    return dx < dy ? float3(dx, sign(p.x), 0.0) : float3(dy, 0.0, sign(p.y));
  }
  float r = min(radius, min(half_size.x, half_size.y));
  float2 q = abs(p) - (half_size - r);
  float2 o = max(q, 0.0);
  float l = length(o);
  float d = r - (l + min(max(q.x, q.y), 0.0));
  float2 n;
  if (l > 0.0) {
    n = (o / l) * sign(p);
  } else if (q.x > q.y) {
    n = float2(sign(p.x), 0.0);
  } else {
    n = float2(0.0, sign(p.y));
  }
  return float3(d, n);
}
"""

/**
 * The rim, as iOS lights it, at a point `points` in from the edge with outward direction `n`,
 * premultiplied, to lay over the glass. And the tone iOS gives what's behind.
 */
private const val RIM = """
half4 rim(float points, float2 n, float2 light, float shine, float clear) {
  float facing = dot(n, light);
  float end = facing * facing;
  float side = 1.0 - end;
  float lit = 0.0;
  float shade = 0.0;
  if (points >= 0.0) {
    float line = max(0.0, 0.39 - 0.29 * points);
    if (facing > 0.0) {
      lit = end * (line + (points > 1.0 ? 0.05 * max(0.0, 1.0 - (points - 1.0) / 2.5) : 0.0));
      shade = end * 0.02 * max(0.0, 1.0 - abs(points - 9.0) / 5.0);
    } else if (facing < 0.0) {
      lit = end * line;
    }
    shade += side * 0.02 * clamp((15.0 - points) / 5.0, 0.0, 1.0);
  } else {
    // Six tenths of what the web version draws: at the phone's own resolution the web's hairline
    // reads darker than iOS's, measured against the iPhone simulator.
    shade = (side * 0.45 + end * 0.12) * clamp(1.0 + points / 0.75, 0.0, 1.0);
  }
  // Clear glass has nothing lifting it, so its lit edge stands out more.
  lit = clamp(lit * shine * (1.0 + clear * 1.1), 0.0, 1.0);
  shade = clamp(shade * shine, 0.0, 1.0);
  float alpha = lit + shade - lit * shade;
  float white = lit + shade > 0.0 ? lit / (lit + shade) : 0.0;
  return half4(half3(white * alpha), half(alpha));
}

// The rim averaged across the pixel. Its hairline is darkest right at the edge, so read only at
// the pixel's middle it would step from pixel to pixel along a curve; iOS's meets the glass in a
// smooth pixel.
half4 rimAcross(float d, float density, float2 n, float2 light, float shine, float clear) {
  half4 sum = half4(0.0);
  for (int i = 0; i < 4; i++) {
    sum += rim((d + (float(i) - 1.5) * 0.25) / density, n, light, shine, clear);
  }
  return sum * 0.25;
}

half3 tone(half3 rgb, float contrast, float brightness, float saturation) {
  rgb = (rgb - 0.5) * contrast + 0.5;
  rgb *= brightness;
  half grey = dot(rgb, half3(0.2126, 0.7152, 0.0722));
  return clamp(mix(half3(grey), rgb, saturation), 0.0, 1.0);
}
"""

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
uniform float clear;
uniform float zoom;
uniform float split;
uniform float lens;
uniform float prominent;
uniform float3 glow;
uniform half3 base;
uniform half4 tint;
uniform float2 light;
""" + EDGE + RIM + """
half4 main(float2 coord) {
  float2 half_size = size * 0.5;
  float2 middle = margin + half_size;
  float3 e = edge(coord - middle, half_size, radius);
  float d = e.x;
  float2 n = e.yz;
  if (d / density < -1.0) return half4(0.0);
  half4 over = rimAcross(d, density, n, light, shine, clear);

  // Past the edge there's only the hairline.
  half cover = half(clamp(d + 0.5, 0.0, 1.0));
  if (cover <= 0.0) return over;

  // A pane pulls in what lies further in, by an amount that falls in a straight line across the
  // bezel. A lens, like a held thumb, bends light as a curved surface does, steeply at the very
  // rim, and shows there what lies just outside it.
  float shift = 0.0;
  if (d >= 0.0 && d < bezel) {
    float t = 1.0 - d / bezel;
    shift = lens > 0.5 ? -reach * t * t * t : reach * t;
  }
  // A lens enlarges what's under it about its middle, then bends it at the rim. Its colours part
  // there, red bending furthest, as light through a real lens does.
  float2 from = middle + (coord - middle) / zoom;
  float2 bend = n * shift;
  half4 seen = content.eval(from - bend);
  if (split > 0.0) {
    seen.r = content.eval(from - bend * (1.0 + split)).r;
    seen.b = content.eval(from - bend * (1.0 - split)).b;
  }
  // Where nothing was drawn, the window shows through.
  half3 rgb = seen.rgb + base * (1.0 - seen.a);
  if (prominent > 0.5) {
    // A filled button is its colour, darkened a little by what's behind: over white it's 98% of
    // its colour and over a deep blue 85%, measured on the iPhone simulator.
    half behind = dot(rgb, half3(0.2126, 0.7152, 0.0722));
    rgb = tint.rgb * (0.8 + 0.2 * behind);
  } else {
    rgb = tone(rgb, contrast, brightness, saturation);
    rgb = mix(rgb, tint.rgb, tint.a);
  }
  // Under a finger, a faint light where it's touching, as a wide soft circle.
  if (glow.z > 0.0) {
    float r = length(coord - margin - glow.xy) / (240.0 * density);
    float g = r < 0.5 ? mix(0.035, 0.025, r / 0.5) : mix(0.025, 0.0, clamp((r - 0.5) / 0.5, 0.0, 1.0));
    rgb += (1.0 - rgb) * half(g * glow.z);
  }
  return over + half4(rgb, 1.0) * cover * (1.0 - over.a);
}
"""

// Glass in a group, drawn as one surface. Each piece is a rounded rectangle, and their distance
// fields are blended where they come within `spacing` of each other, so pieces that come close
// flow together as iOS glass does in a container. It's the web version's blend
// (src/internal/contour.ts). The optics and rim are the pane's, with the edge and its direction
// taken from the blended shape.
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
uniform float clear;
uniform half3 base;
uniform float2 light;
""" + EDGE + RIM + """
float field(float2 p) {
  float f = 100000.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) < count) {
      float4 r = rects[i];
      float2 half_size = r.zw * 0.5;
      float next = -edge(p - r.xy - half_size, half_size, radii[i]).x;
      float h = max(spacing - abs(f - next), 0.0) / max(spacing, 0.001);
      f = min(f, next) - h * h * spacing * 0.25;
    }
  }
  return f;
}

half4 main(float2 coord) {
  float f = field(coord);
  if (-f / density < -1.0) return half4(0.0);
  float2 g = float2(field(coord + float2(1.0, 0.0)) - field(coord - float2(1.0, 0.0)),
                    field(coord + float2(0.0, 1.0)) - field(coord - float2(0.0, 1.0)));
  float2 n = length(g) > 0.0001 ? normalize(g) : float2(0.0, 1.0);
  float d = -f;
  half4 over = rimAcross(d, density, n, light, shine, clear);
  half cover = half(clamp(d + 0.5, 0.0, 1.0));
  if (cover <= 0.0) return over;

  float shift = 0.0;
  if (d >= 0.0 && d < bezel) shift = reach * (1.0 - d / bezel);
  half4 seen = content.eval(coord - n * shift);
  half3 rgb = seen.rgb + base * (1.0 - seen.a);
  rgb = tone(rgb, contrast, brightness, saturation);
  return over + half4(rgb, 1.0) * cover * (1.0 - over.a);
}
"""
