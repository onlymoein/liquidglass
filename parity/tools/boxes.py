# boxes.py <png> <x> [bg] [tol]: finds shapes down a column, then measures each across its middle. Sizes in pt.
import subprocess, sys
f, X = sys.argv[1], int(sys.argv[2]); bg = int(sys.argv[3]) if len(sys.argv) > 3 else 128; tol = int(sys.argv[4]) if len(sys.argv) > 4 else 10
def line(*a): return [tuple(map(int, l.split())) for l in subprocess.run(['.build/sample', f, *map(str, a)], capture_output=True, text=True).stdout.splitlines()]
col = line('col', X, 0, 2621)
spans, on = [], None
for y, r, g, b in col:
    d = abs(r-bg) > tol or abs(g-bg) > tol or abs(b-bg) > tol
    if d and on is None: on = y
    if not d and on is not None:
        if y - on > 2: spans.append((on, y-1))
        on = None
merged = []
for s in spans:
    if merged and s[0] - merged[-1][1] < 12: merged[-1] = (merged[-1][0], s[1])
    else: merged.append(s)
for a, b in merged:
    mid = (a+b)//2; row = line('row', mid, 0, 1205)
    xs = [x for x, r, g, c in row if abs(r-bg) > tol or abs(g-bg) > tol or abs(c-bg) > tol]
    print(f"y {a/3:6.1f}..{b/3:6.1f} h {(b-a+1)/3:5.1f}   x {xs[0]/3 if xs else 0:6.1f}..{xs[-1]/3 if xs else 0:6.1f} w {((xs[-1]-xs[0]+1)/3) if xs else 0:6.1f}  colour@edge+6px {row[xs[0]+12][1:] if xs else ''}")
