# Fits a CSS backdrop-filter chain to measured glass: contrast, brightness, brightness (knee), saturate.
import sys, random
def load(path, mode, engine, kind):
    out = []
    for l in open(path):
        p = l.split()
        if p[:3] == [mode, engine, kind]:
            h = p[3]; out.append(((int(h[:2],16),int(h[2:4],16),int(h[4:],16)), tuple(float(v) for v in p[4:7])))
    return out
clip = lambda v: max(0.0, min(255.0, v))
def apply(c, b, k, s, px):
    v = [clip(clip((x-127.5)*c+127.5)*b) for x in px]
    v = [x*k for x in v]
    L = .2126*v[0]+.7152*v[1]+.0722*v[2]
    return [clip(L+s*(x-L)) for x in v]
def err(data, p):
    t = 0
    for i, o in data:
        for a, b in zip(apply(*p, i), o): t += (a-b)**2
    return (t/(3*len(data)))**.5
def fit(data, knee):
    best, score = None, 1e9
    random.seed(4)
    for start in range(30):
        p = [random.uniform(.2,1), random.uniform(.5,2.5), random.uniform(.4,1) if knee else 1.0, random.uniform(.8,2.5)]
        e = err(data, p); step = .2
        while step > .0005:
            moved = False
            for i in range(4):
                if i == 2 and not knee: continue
                for d in (step, -step):
                    q = list(p); q[i] += d
                    f = err(data, q)
                    if f < e: p, e, moved = q, f, True
            if not moved: step /= 2
        if e < score: best, score = p, e
    return best, score
a = '.build/colors-regular.txt'; b = '.build/colors-more.txt'
for name, path, mode, kind, knee in [('light regular',a,'light','regular',False),('dark regular',a,'dark','regular',True),('dark regular, no knee',a,'dark','regular',False),('clear',b,'light','clear',False)]:
    d = load(path, mode, 'native', kind)
    p, e = fit(d, knee)
    print(f"{name}: contrast({p[0]:.3f}) brightness({p[1]:.3f}) brightness({p[2]:.3f}) saturate({p[3]:.3f})  rms {e:.1f}")
    if name.endswith('knee') or name=='light regular':
        for i, o in d: print('  ', i, o, [round(v) for v in apply(*p, i)])
