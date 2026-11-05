#!/bin/bash
# lens.sh <engine> <w> <h> <r> <edge pts...>: prints output rows across the left rim for a step at each position.
HERE="$(cd "$(dirname "$0")/.." && pwd)"; S="$HERE/.build/s"
engine=$1; w=$2; h=$3; r=$4; shift 4
left=$(python3 -I -c "print(int((201-$w/2)*3))")
for e in "$@"; do WAIT=${WAIT:-2} "$HERE/run.sh" shot $engine light "$S/l.png" -edge $e -kind regular -w $w -h $h -r $r 2>/dev/null
 echo "edge+$(python3 -I -c "print(int($e*3-$left))")px: $("$HERE/.build/sample" "$S/l.png" row 900 $left $((left+${SPAN:-114})) | awk 'NR%6==1{printf "%s ",$2}')"; done
