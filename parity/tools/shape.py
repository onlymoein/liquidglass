# shape.py <frames dir> [threshold] [first] [last]: on a plain grey backdrop, the bright glass in each frame, in points.
# Widest row, tallest column, and the width a quarter of the way down, so a pill with a drop under it can be told apart.
import os, subprocess, sys

d = sys.argv[1]
T = int(sys.argv[2]) if len(sys.argv) > 2 else 150
first = int(sys.argv[3]) if len(sys.argv) > 3 else 0
last = int(sys.argv[4]) if len(sys.argv) > 4 else 10**6
W, H = 402, 874
raw = subprocess.run(["ffmpeg", "-v", "error", "-start_number", str(first), "-i", f"{d}/%04d.png", "-frames:v", str(max(1, last - first + 1)), "-vf", f"scale={W}:{H}:flags=area,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
for i in range(len(raw) // (W * H)):
    f = raw[i * W * H : (i + 1) * W * H]
    rows = []
    for y in range(int(os.environ.get("YMIN", 80)), int(os.environ.get("YMAX", H))):
        xs = [x for x in range(W) if f[y * W + x] > T]
        if len(xs) > 6:
            rows.append((y, xs[0], xs[-1]))
    if not rows:
        print(f"{first + i:4} none")
        continue
    y0, y1 = rows[0][0], rows[-1][0]
    x0 = min(r[1] for r in rows)
    x1 = max(r[2] for r in rows)
    bottom = [r for r in rows if r[0] >= y1 - (y1 - y0) // 4]
    low = max(r[2] - r[1] + 1 for r in bottom)
    print(f"{first + i:4} w{x1 - x0 + 1:4} h{y1 - y0 + 1:4} x{x0:4}..{x1:<4} y{y0:4}..{y1:<4} cx{(x0 + x1 + 1) / 2:6.1f} cy{(y0 + y1 + 1) / 2:6.1f} low{low:4}")
