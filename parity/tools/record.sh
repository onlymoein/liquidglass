#!/bin/bash
# Records every interaction on real controls and on the web page, at 60fps, to .build/m/<name>-<native|web>/.
# record.sh [engine] [name...]: both engines and everything by default. The driver must be running.
HERE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$HERE"
w(){ perl -e "select(undef,undef,undef,$1)"; }
engines=${1:-native web}; [ "$engines" = all ] && engines="native web"; shift
want=" $* "
take(){ # name secs scene setup-gesture gesture...
  local name=$1 secs=$2 scene=$3 setup=$4; shift 4
  [ "$want" != "  " ] && [[ "$want" != *" $name "* ]] && return
  for e in $engines; do
    ./run.sh do launch -engine "$e" -scene "$scene" -bg "${BG:-grid}"; w ${SETTLE:-4.5}
    if [ -n "$setup" ]; then ./run.sh do $setup; w 1.2; fi
    tools/capture.sh "$name$SUF-$e" "$secs" "$@" >/dev/null
    echo "$name$SUF-$e $(ls .build/m/$name$SUF-$e | wc -l | tr -d ' ') frames"
  done
}
./run.sh appearance light
take press-button 1.6 all "" press 201 240 0.6
take press-filled 1.6 all "" press 201 300 0.6
take press-large 1.6 all "" press 201 360 0.6
take switch-tap 1.4 all "" tap 201 480
take switch-hold 2 all "" press 201 480 1
take slider-hold 2 all "" press 201 540 1
take slider-end 2 all "" drag 201 540 380 540 0.3
take slider-start 2.4 all "" drag 201 540 2 540 0.3
take tabs-tap 1.6 tabs "" tap 201 815
take tabs-hold 2 tabs "" press 201 815 1
take menu-open 1.6 menu "" tap 201 266
take menu-close 1.6 menu "tap 201 266" tap 201 760
take slider-offset 2 all "" drag 216 540 300 540 0.3
take slider-track 2 all "" tap 330 540
take alert-open 1.4 show-alert "" tap 201 200
take sheet-open 1.6 show-sheet "" tap 201 200
