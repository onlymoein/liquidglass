# rim.py <png>: profiles across the left, top and bottom edges of the 300x120 panel, every device px near the edge.
import subprocess, sys
f = sys.argv[1]
def line(*a): return [int(l.split()[1]) for l in subprocess.run(['.build/sample', f, *map(str, a)], capture_output=True, text=True).stdout.splitlines()]
print(' L out', line('row', 900, 60, 150)[::15], 'edge', line('row', 900, 148, 162), 'in', line('row', 900, 165, 250)[::15])
print(' T out', line('col', 603, 600, 718)[::20], 'edge', line('col', 603, 716, 730), 'in', line('col', 603, 732, 820)[::15])
print(' B in', line('col', 603, 990, 1078)[::15], 'edge', line('col', 603, 1076, 1086), 'out', line('col', 603, 1086, 1200)[::20])
