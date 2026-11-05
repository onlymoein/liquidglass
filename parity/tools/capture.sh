#!/bin/bash
# capture.sh <name> <seconds> <gesture command...>: records the screen while a gesture runs, then writes 60fps frames.
HERE="$(cd "$(dirname "$0")/.." && pwd)"; B="$HERE/.build"; name=$1; secs=$2; shift 2
D=$(xcrun simctl list devices available | grep -E "^\s+iPhone 17 \(" | head -1 | grep -oE "[0-9A-F-]{36}")
rm -rf "$B/m/$name"; mkdir -p "$B/m/$name"
xcrun simctl io "$D" recordVideo --codec=h264 --force "$B/m/$name.mp4" >/dev/null 2>&1 &
rec=$!
perl -e 'select(undef,undef,undef,0.6)'
"$HERE/run.sh" do "$@"
perl -e "select(undef,undef,undef,$secs)"
kill -INT $rec; wait $rec 2>/dev/null
"$B/frames" "$B/m/$name.mp4" "$B/m/$name" 0 $((${secs%.*}+3)) 0.016667 >/dev/null
ls "$B/m/$name" | wc -l | tr -d ' '
