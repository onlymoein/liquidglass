# px.py <image> <command> ...: reads pixels without any libraries (ffmpeg decodes). Device px.
#   at x y [x y ...]        colour at each point, averaged over 5x5
#   row y [x0 x1]           the runs of similar colour along a row
#   col x [y0 y1]           the same down a column
#   box x0 y0 x1 y1         mean colour of a rectangle
#   dark x0 y0 x1 y1        the darkest pixel in a rectangle (for the colour of text)
import subprocess, sys

path, command, args = sys.argv[1], sys.argv[2], [int(v) for v in sys.argv[3:]]
probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip().split(",")
W, H = int(probe[0]), int(probe[1])
data = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout


def get(x, y):
    i = (y * W + x) * 3
    return data[i], data[i + 1], data[i + 2]


def mean(x0, y0, x1, y1):
    total = [0, 0, 0]
    n = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            c = get(x, y)
            for k in range(3):
                total[k] += c[k]
            n += 1
    return tuple(round(v / n) for v in total)


if command == "at":
    for x, y in zip(args[0::2], args[1::2]):
        print(x, y, mean(x - 2, y - 2, x + 3, y + 3))
elif command == "box":
    print(mean(*args))
elif command == "dark":
    x0, y0, x1, y1 = args
    best = min((get(x, y) for y in range(y0, y1) for x in range(x0, x1)), key=sum)
    print(best)
elif command in ("row", "col"):
    fixed = args[0]
    a = args[1] if len(args) > 1 else 0
    b = args[2] if len(args) > 2 else (W if command == "row" else H)
    tolerance = 6
    start = a
    last = get(a, fixed) if command == "row" else get(fixed, a)
    for i in range(a + 1, b):
        c = get(i, fixed) if command == "row" else get(fixed, i)
        if max(abs(c[k] - last[k]) for k in range(3)) > tolerance:
            print(f"{start:5}..{i - 1:5} n={i - start:4} {last}")
            start = i
        last = c
    print(f"{start:5}..{b - 1:5} n={b - start:4} {last}")
