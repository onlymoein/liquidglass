#!/bin/bash
HERE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$HERE"; R=.build/r; w(){ perl -e "select(undef,undef,undef,$1)"; }
./run.sh appearance light
for gap in 40 14 6 0; do for e in native web; do ./run.sh do launch -engine $e -scene merge -gap $gap -bg grid; w 2; ./run.sh snap x $R/mg-$e-$gap.png; sips -c 300 600 --cropOffset 740 303 $R/mg-$e-$gap.png --out $R/mgc-$e-$gap.png >/dev/null; done; done
./run.sh do launch -engine native -scene minimize -bg grid; w 1.8; tools/capture.sh minimize 1.2 drag 201 700 201 200 0.05 >/dev/null; ./run.sh snap x $R/min1.png; sips -c 320 1206 --cropOffset 2302 0 $R/min1.png --out $R/min1c.png >/dev/null
