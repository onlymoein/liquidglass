#!/bin/bash
# Pictures of controls while a finger is on them, real and ours.
HERE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$HERE"; R=.build/r; w(){ perl -e "select(undef,undef,undef,$1)"; }
shot(){ # name args gesture
  for e in native web; do ./run.sh do launch -engine $e $2; w 2; ./run.sh do $3 & w ${4:-0.9}; ./run.sh snap x $R/h-$1-$e.png; wait; done
  .build/stitch $R/h-$1.png $R/h-$1-native.png $R/h-$1-web.png; sips -c 500 2436 --cropOffset ${5:-650} 0 $R/h-$1.png --out $R/hc-$1.png >/dev/null
}
./run.sh appearance light
shot switch "-kind switch -scene panel -bg grid" "press 201 300 2"
shot slider "-kind slider -w 300 -scene panel -bg grid" "press 201 300 2"
shot tabs "-scene tabs -bg grid" "press 201 815 2" 0.9 2150
