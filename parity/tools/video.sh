#!/bin/bash
# video.sh <out.mp4>: a side-by-side film from what tools/record.sh recorded, real iOS on the left and the
# library on the right, each take lined up on the frame its own side starts to move. Normal speed, then a
# quarter speed pass of everything that moves.
HERE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$HERE"; B=.build; T=$B/video; rm -rf "$T"; mkdir -p "$T"
out=$1
xcrun -sdk macosx swiftc -O tools/label.swift -o "$B/label" 2>/dev/null

# Finds the first frame in a region that differs from the first frame of the take.
onset(){ python3 -I - "$@" <<'PY'
import subprocess, sys
d, x, y, w, h = sys.argv[1], *map(int, sys.argv[2:6])
W, H = max(1, w // 6), max(1, h // 6)
p = subprocess.run(["ffmpeg", "-v", "error", "-i", f"{d}/%04d.png", "-vf", f"crop={w}:{h}:{x}:{y},scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
frames = [p[i : i + W * H] for i in range(0, len(p), W * H)]
diffs = [sum(abs(a - b) for a, b in zip(f, frames[0])) / (W * H) for f in frames]
peak = max(diffs) or 1
print(next((i for i, v in enumerate(diffs) if v > max(0.6, peak * 0.02)), 0))
PY
}

n=0
clip(){ # title take speed frames x y w h
  local title=$1 take=$2 speed=$3 len=$4 x=$5 y=$6 w=$7 h=$8
  local a b; a=$(onset "$B/m/$take-native" "$x" "$y" "$w" "$h"); b=$(onset "$B/m/$take-web" "$x" "$y" "$w" "$h")
  a=$((a > 20 ? a - 20 : 0)); b=$((b > 20 ? b - 20 : 0))
  "$B/label" "$T/label.png" "$title"
  n=$((n + 1))
  ffmpeg -v error -y -framerate 60 -start_number "$a" -i "$B/m/$take-native/%04d.png" -framerate 60 -start_number "$b" -i "$B/m/$take-web/%04d.png" -loop 1 -framerate 60 -i "$T/label.png" \
    -filter_complex "[0]scale=504:1096,pad=506:1096:0:0:black,tpad=stop_mode=clone:stop_duration=3[l];[1]scale=506:1096,tpad=stop_mode=clone:stop_duration=3[r];[l][r]hstack=2[row];[2][row]vstack=2:shortest=1,setpts=$speed*PTS,fps=60,format=yuv420p" \
    -t "$(python3 -I -c "print($len/60*$speed)")" -c:v libx264 -crf 16 -preset veryfast -pix_fmt yuv420p "$T/$(printf %03d $n).mp4"
  echo "$take native+$a web+$b"
}

controls="Controls: switch, slider, buttons"
for speed in 1 4; do
  suffix=""; [ "$speed" = 4 ] && suffix="  (1/4 speed)"
  clip "Buttons: press$suffix" press-button $speed 110 300 640 606 160
  clip "Buttons: press, filled$suffix" press-filled $speed 110 300 820 606 160
  clip "Buttons: press, large$suffix" press-large $speed 110 300 1000 606 160
  clip "Switch: tap$suffix" switch-tap $speed 80 400 1380 400 120
  clip "Slider: hold$suffix" slider-hold $speed 110 100 1550 1006 140
  clip "Slider: drag$suffix" slider-end $speed 100 100 1550 1006 140
  clip "Slider: tap on the track$suffix" slider-track $speed 70 100 1550 1006 140
  clip "Menu: open$suffix" menu-open $speed 85 0 500 1206 900
  clip "Menu: close$suffix" menu-close $speed 85 0 500 1206 900
  clip "Alert$suffix" alert-open $speed 70 60 900 1086 800
  clip "Sheet$suffix" sheet-open $speed 90 0 900 1206 1722
  clip "Tab bar: tap$suffix" tabs-tap $speed 85 100 2320 1006 302
  clip "Tab bar: hold$suffix" tabs-hold $speed 120 100 2320 1006 302
done
ls "$T"/*.mp4 | sed "s|^$T/|file '|; s|$|'|" > "$T/list.txt"
(cd "$T" && ffmpeg -v error -y -f concat -safe 0 -i list.txt -c copy "out.mp4")
mv "$T/out.mp4" "$out"
ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$out"
