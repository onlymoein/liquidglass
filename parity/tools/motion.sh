#!/bin/bash
HERE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$HERE"; w(){ perl -e "select(undef,undef,undef,$1)"; }
./run.sh appearance light
pair(){ # name launchargs gesture x y tol
  n=$1; args=$2; g=$3; x=$4; y=$5; tol=${6:-6}
  for e in native web; do ./run.sh do launch -engine $e $args; w 2; tools/capture.sh $n-$e ${SECS:-1.3} $g >/dev/null; echo "--- $n $e"; python3 -I tools/track.py .build/m/$n-$e $x $y 128 $tol | awk -v s=${EVERY:-2} 'NR%s==1' | head -${LINES_MAX:-16}; done
}
pair press "-kind button-large -scene panel -bg 808080" "press 201 300 0.5" 603 900
pair menu "-scene menu -bg 808080" "tap 201 266" 603 1000
