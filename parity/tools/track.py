# track.py <frames dir> <x> <y> [bg] [tol]: width and height of what differs from the background along a row and column, per frame, device px.
import os, subprocess, sys
d, x, y = sys.argv[1], sys.argv[2], sys.argv[3]; bg = int(sys.argv[4]) if len(sys.argv) > 4 else 128; tol = int(sys.argv[5]) if len(sys.argv) > 5 else 8
S = os.path.join(os.path.dirname(d.rstrip("/")), "..", "sample")
last = None
for i, f in enumerate(sorted(os.listdir(d))):
    p = os.path.join(d, f)
    r = [l.split() for l in subprocess.run([S, p, "row", y, "0", "1205"], capture_output=True, text=True).stdout.splitlines()]
    c = [l.split() for l in subprocess.run([S, p, "col", x, "0", "2500"], capture_output=True, text=True).stdout.splitlines()]
    a = [int(v[0]) for v in r if abs(int(v[1]) - bg) > tol]; b = [int(v[0]) for v in c if abs(int(v[1]) - bg) > tol]
    now = (a[0] if a else 0, a[-1] if a else 0, b[0] if b else 0, b[-1] if b else 0)
    if now != last: print(f"{i*1000/60:7.0f}ms x {now[0]:5}..{now[1]:5} w{(now[1]-now[0]+1)/3:6.1f}  y {now[2]:5}..{now[3]:5} h{(now[3]-now[2]+1)/3:6.1f}")
    last = now
