# Writes the test backgrounds. Greys only, so colour shifts can't be mistaken for movement.
import struct, sys, zlib
W, H = 1206, 2622
def png(path, row):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    raw = b"".join(b"\0" + row(y) for y in range(H))
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 0, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))
out = sys.argv[1]
# Black to the left of x = 201pt, white to the right.
step = bytes(0 if x < 603 else 255 for x in range(W))
png(f"{out}/step.png", lambda y: step)
# A triangle wave across, every 100pt, to read how far the glass moves things sideways.
ramp = bytes(int(abs(((x / 3) % 100) / 50 - 1) * 255) for x in range(W))
png(f"{out}/ramp.png", lambda y: ramp)
# Thin dark lines every 10pt, across and down, to read where the rim moves them to.
lines = bytes(40 if x % 30 < 4 else 170 for x in range(W))
png(f"{out}/lines.png", lambda y: lines)
plain = bytes([170]) * W; dark = bytes([40]) * W
png(f"{out}/hlines.png", lambda y: dark if y % 30 < 4 else plain)

# A colourful grid, for looking at.
def colour(path):
    stops=[(255,149,0),(255,45,110),(120,60,220),(0,136,255),(0,200,160)]
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    rows=[]
    for y in range(H):
        row=bytearray(b"\0"+bytes(W*3))
        for x in range(W):
            t=(x/W*0.35+y/H*0.65)*4; i=min(int(t),3); f=t-i
            c=[int(stops[i][k]+(stops[i+1][k]-stops[i][k])*f) for k in range(3)]
            if (x//90+y//90)%2==0: c=[min(255,v+26) for v in c]
            if x%90<6 or y%90<6: c=[v//3 for v in c]
            row[1+x*3:4+x*3]=bytes(c)
        rows.append(bytes(row))
    open(path,"wb").write(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",W,H,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(b"".join(rows),6))+chunk(b"IEND",b""))
colour(f"{out}/grid.png")
