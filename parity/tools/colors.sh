#!/bin/bash
# Prints what glass does to each flat colour behind it: mode engine kind input output.
HERE="$(cd "$(dirname "$0")/.." && pwd)"; S="$HERE/.build/s"; mkdir -p "$S"
KIND=${KIND:-regular}; EXTRA=${EXTRA:-}
for mode in ${MODES:-light dark}; do for engine in ${ENGINES:-native web}; do
  for bg in 000000 202020 404040 606060 808080 a0a0a0 c0c0c0 e0e0e0 ffffff ff0000 00ff00 0000ff ffff00 ff00ff 00ffff ff9500 5856d6 34c759; do
    w=2.0; [ $engine = web ] && w=3
    WAIT=$w "$HERE/run.sh" shot $engine $mode "$S/c.png" -bg $bg -kind $KIND $EXTRA 2>/dev/null
    echo "$mode $engine $KIND $bg $("$HERE/.build/sample" "$S/c.png" mean 503 860 200 80)"
  done
done; done
