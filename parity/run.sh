#!/bin/bash
# build | start | stop | shot <engine> <light|dark> <out.png> [-arg value ...]
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; B="$HERE/.build"; ID=local.liquidglass.parity
D=$(xcrun simctl list devices available | grep -E "^\s+iPhone 17 \(" | head -1 | grep -oE "[0-9A-F-]{36}")
case "$1" in
build)
  mkdir -p "$B/Parity.app" "$B/web"
  python3 -I "$HERE/tools/walls.py" "$B/web"
  xcrun -sdk macosx swiftc -O "$HERE/tools/sample.swift" -o "$B/sample" 2>&1 | grep -v warning || true
  xcrun -sdk macosx swiftc -O "$HERE/tools/frames.swift" -o "$B/frames" 2>&1 | grep -v warning || true
  xcrun -sdk macosx swiftc -O "$HERE/tools/stitch.swift" -o "$B/stitch" 2>&1 | grep -v warning || true
  cp "$HERE/app/Info.plist" "$B"/web/*.png "$B/Parity.app/"
  xcrun -sdk iphonesimulator swiftc -target arm64-apple-ios26.0-simulator -parse-as-library "$HERE/app/ParityApp.swift" -o "$B/Parity.app/Parity"
  codesign -f -s - "$B/Parity.app" 2>/dev/null
  (cd "$HERE/.." && npm run -s build >/dev/null && npx rolldown parity/web/entry.tsx --file parity/.build/web/bundle.js --format iife --define 'process.env.NODE_ENV="production"' >/dev/null 2>&1)
  cp "$HERE/web/index.html" "$B/web/"
  cp "$B/web/bundle.js" "$B/web/index.html" "$B/Parity.app/"
  codesign -f -s - "$B/Parity.app" 2>/dev/null; ls -la "$B/web/bundle.js" ;;
start)
  xcrun simctl boot "$D" 2>/dev/null || true; xcrun simctl bootstatus "$D" -b >/dev/null 2>&1
  xcrun simctl install "$D" "$B/Parity.app" 2>/dev/null
  xcrun simctl status_bar "$D" override --time 9:41 2>/dev/null || true ;;
ui)
  # Builds the driver and app with Xcode; later `do` commands run through it.
  mkdir -p "$B/drive"; cd "$HERE/ui" && xcodegen generate --quiet >/dev/null
  xcodebuild build-for-testing -project "$HERE/ui/Parity.xcodeproj" -scheme Parity -destination "id=$D" -derivedDataPath "$B/dd" CODE_SIGNING_ALLOWED=YES -quiet 2>&1 | grep -vE "^(Install|$)" | tail -5 ;;
drive)
  # Runs the driver until `do stop`. Run it in the background.
  : > "$B/drive/commands.txt"; : > "$B/drive/done.txt"
  SIMCTL_CHILD_PARITY_DIR="$B/drive" TEST_RUNNER_PARITY_DIR="$B/drive" xcodebuild test-without-building -project "$HERE/ui/Parity.xcodeproj" -scheme Parity -destination "id=$D" -derivedDataPath "$B/dd" -only-testing:Driver/Driver/testDrive 2>&1 | tail -3 ;;
do)
  # do <command...>: sends one command and waits for it to finish.
  shift; echo "$*" >> "$B/drive/commands.txt"; want=$(wc -l < "$B/drive/commands.txt" | tr -d ' ')
  for i in $(seq 1 400); do [ "$(cat "$B/drive/done.txt" 2>/dev/null)" = "$want" ] && break; perl -e 'select(undef,undef,undef,0.05)'; done ;;
snap)
  # snap <light|dark> <out.png>: a screenshot of what's on screen now.
  xcrun simctl io "$D" screenshot --type=png "$3" >/dev/null 2>&1 ;;
install) xcrun simctl install "$D" "$B/Parity.app" 2>/dev/null ;;
appearance) xcrun simctl ui "$D" appearance "$2" 2>/dev/null ;;
stop)
  xcrun simctl terminate "$D" $ID 2>/dev/null || true; xcrun simctl uninstall "$D" $ID 2>/dev/null || true
  xcrun simctl ui "$D" appearance light 2>/dev/null || true; xcrun simctl shutdown "$D" 2>/dev/null || true ;;
shot)
  engine=$2; mode=$3; out=$4; shift 4
  xcrun simctl ui "$D" appearance "$mode" 2>/dev/null
  xcrun simctl terminate "$D" $ID >/dev/null 2>&1 || true
  xcrun simctl launch "$D" $ID -engine "$engine" "$@" >/dev/null 2>&1
  perl -e "select(undef,undef,undef,${WAIT:-2.2})"
  xcrun simctl io "$D" screenshot --type=png "$out" >/dev/null 2>&1 ;;
esac
